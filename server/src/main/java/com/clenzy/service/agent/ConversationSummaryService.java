package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.ResolvedTarget;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.function.Consumer;

/**
 * Rolling summary de conversation (campagne X6, architecture de contexte B).
 *
 * <p>Au-dela de la fenetre glissante ({@link ContextBudget#MAX_HISTORY_MESSAGES}),
 * plutot que d'elaguer sec le debut de conversation, on en maintient un resume
 * structure compact — injecte en tete de contexte par
 * {@link ConversationHistoryMapper}. Le resume est regenere PARESSEUSEMENT :
 * seulement quand assez de messages sont sortis de la fenetre depuis le dernier
 * resume ({@code refresh-threshold}), pas a chaque tour.</p>
 *
 * <p>Cout maitrise : 1 appel petit modele (tier SMALL, cf. TierModelResolver)
 * amorti sur N tours, hors chemin critique (appele apres la reponse). Best-effort :
 * un echec laisse l'ancien resume (ou aucun) — jamais de blocage du chat.</p>
 *
 * <p>Flag {@code clenzy.assistant.rolling-summary.enabled} (defaut false) :
 * activation mesuree, comme les autres leviers tokens.</p>
 */
@Service
public class ConversationSummaryService {

    private static final Logger log = LoggerFactory.getLogger(ConversationSummaryService.class);

    private static final String SUMMARY_SYSTEM_PROMPT = """
            Tu resumes le debut d'une conversation entre un gestionnaire immobilier et son
            assistant, pour preserver le contexte sans tout renvoyer. Produis un resume
            FACTUEL et COMPACT (max 150 mots) structure en :
            - Objectifs/demandes recurrents de l'utilisateur
            - Decisions prises et actions realisees
            - Preferences et contraintes exprimees
            - Points en suspens
            Pas de bavardage, pas de salutations. Francais.""";

    private final ChatLLMProvider chatProvider;
    private final AiTargetResolver targetResolver;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final TierModelResolver tierModelResolver;
    private final boolean enabled;
    private final int refreshThreshold;

    public ConversationSummaryService(ChatLLMProvider chatProvider,
                                      AiTargetResolver targetResolver,
                                      AssistantConversationRepository conversationRepository,
                                      AssistantMessageRepository messageRepository,
                                      TierModelResolver tierModelResolver,
                                      @Value("${clenzy.assistant.rolling-summary.enabled:false}") boolean enabled,
                                      @Value("${clenzy.assistant.rolling-summary.refresh-threshold:10}") int refreshThreshold) {
        this.chatProvider = chatProvider;
        this.targetResolver = targetResolver;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.tierModelResolver = tierModelResolver;
        this.enabled = enabled;
        this.refreshThreshold = refreshThreshold;
    }

    /**
     * Rafraichit le resume si la conversation a suffisamment grossi hors fenetre.
     * A appeler APRES la reponse (hors chemin critique). Best-effort, ne leve jamais.
     *
     * @param apiKey cle resolue (BYOK/plateforme) — reutilisee pour l'appel resume
     */
    @Transactional
    public void refreshIfNeeded(AssistantConversation conversation, AgentContext context, String apiKey) {
        if (!enabled || conversation == null) {
            return;
        }
        try {
            List<AssistantMessage> history = messageRepository.findByConversation(conversation.getId());
            // Cible de couverture : tout ce qui est HORS de la fenetre glissante.
            int outOfWindow = history.size() - ContextBudget.MAX_HISTORY_MESSAGES;
            if (outOfWindow <= 0) {
                return; // rien hors fenetre → pas de resume necessaire
            }
            int alreadyCovered = conversation.getSummaryCoversCount();
            if (outOfWindow - alreadyCovered < refreshThreshold) {
                return; // pas assez de nouveau hors-fenetre depuis le dernier resume
            }

            List<AssistantMessage> toCover = history.subList(0, outOfWindow);
            String rendered = renderForSummary(toCover, conversation.getRollingSummary());

            ResolvedTarget target = targetResolver.resolvePrimary(
                    context.organizationId(), AiFeature.ASSISTANT_CHAT, context.modelOverride());
            String model = tierModelResolver != null
                    ? tierModelResolver.resolveModel(AgentTier.SMALL, target.provider(), target.model())
                    : target.model();

            String summary = callSummary(rendered, model, target, apiKey);
            if (summary != null && !summary.isBlank()) {
                conversation.setRollingSummary(summary.strip());
                conversation.setSummaryCoversCount(outOfWindow);
                conversationRepository.save(conversation);
                log.info("[SUMMARY] Rolling summary rafraichi (conv={}, couvre {} messages)",
                        conversation.getId(), outOfWindow);
            }
        } catch (Exception e) {
            log.warn("[SUMMARY] Rafraichissement en echec (best-effort) : {}", e.getMessage());
        }
    }

    private String renderForSummary(List<AssistantMessage> messages, String previousSummary) {
        StringBuilder sb = new StringBuilder(2048);
        if (previousSummary != null && !previousSummary.isBlank()) {
            sb.append("Resume precedent a completer :\n").append(previousSummary).append("\n\n");
        }
        sb.append("Messages a integrer :\n");
        for (AssistantMessage m : messages) {
            String role = AssistantMessage.ROLE_USER.equals(m.getRole()) ? "Utilisateur" : "Assistant";
            String content = m.getContent();
            if (content != null && !content.isBlank()) {
                sb.append(role).append(" : ")
                        .append(content.length() > 500 ? content.substring(0, 500) : content)
                        .append('\n');
            }
        }
        return sb.toString();
    }

    private String callSummary(String rendered, String model, ResolvedTarget target, String apiKey) {
        ChatRequest request = new ChatRequest(
                SUMMARY_SYSTEM_PROMPT,
                List.of(ChatMessage.user(rendered)),
                List.of(),
                model,
                0.2,
                512,
                null,
                target.provider(),
                target.baseUrl());
        StringBuilder text = new StringBuilder();
        Consumer<ChatEvent> handler = event -> {
            if (event instanceof ChatEvent.Done done) {
                text.append(done.fullText());
            } else if (event instanceof ChatEvent.TextDelta td) {
                text.append(td.delta());
            }
        };
        if (apiKey != null) {
            chatProvider.streamChat(request, handler, apiKey);
        } else {
            chatProvider.streamChat(request, handler);
        }
        return text.toString();
    }
}
