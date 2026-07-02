package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.exception.AiBudgetExceededException;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMemory;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiFeatureProviderRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.ComposedSystemPrompt;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Orchestrateur de l'assistant conversationnel.
 *
 * <p><b>Boucle principale</b> : a chaque tour, on envoie au LLM l'historique de la
 * conversation + la liste des tools. Le LLM peut :
 * <ol>
 *   <li>Repondre en texte → on persiste, on emet les deltas, fin du tour</li>
 *   <li>Demander l'execution d'outils → on execute chaque tool, on appelle le LLM
 *       a nouveau avec les resultats, on continue jusqu'a obtenir une reponse texte
 *       (ou MAX_ITERATIONS pour borner la boucle).</li>
 * </ol>
 *
 * <p><b>Securite</b> :
 * <ul>
 *   <li>Les tools s'executent dans le contexte tenant/user du caller (rien ne bypass).</li>
 *   <li>Les conversations sont scoped par {@code keycloakId} (verifie en amont).</li>
 *   <li>La cle API est resolue via BYOK → fallback plateforme ; jamais loggee.</li>
 * </ul>
 *
 * <p><b>Persistance</b> : a chaque tour, les messages user/assistant/tool sont
 * persistes en BDD avant emission SSE — si la connexion SSE casse en cours
 * de stream, l'historique est conserve.</p>
 *
 * <p><b>Collaborateurs</b> (refactor SRP — comportement strictement identique) :
 * <ul>
 *   <li>{@link AgentPromptComposer} : system prompt (v1 legacy / v2 PromptBuilder),
 *       memoire long-terme et RAG auto-injection</li>
 *   <li>{@link AiTargetResolver} : provider/modele/cle/baseUrl effectifs</li>
 *   <li>{@link AgentToolLoopRunner} : boucle tool-calling + streaming LLM + usage tokens</li>
 *   <li>{@link ConversationHistoryMapper} : historique BDD → messages LLM + attachments</li>
 *   <li>{@link MultiAgentFlowRunner} : flux multi-agent (orchestrateur + specialistes,
 *       feature flag {@code clenzy.assistant.multi-agent.enabled}) + HITL pause/reprise</li>
 * </ul>
 */
@Service
public class AgentOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AgentOrchestrator.class);
    private static final int MAX_TOKENS_PER_TURN = 2048;
    private static final double DEFAULT_TEMPERATURE = 0.3;

    private final ToolRegistry toolRegistry;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final PendingToolStore pendingToolStore;
    private final AgentPromptComposer promptComposer;
    private final AiTargetResolver targetResolver;
    private final AgentToolLoopRunner toolLoopRunner;
    private final ConversationHistoryMapper historyMapper;
    private final MultiAgentFlowRunner multiAgentFlowRunner;
    /** Gate ASSISTANT_CHAT : toggle d'activation + budget, comme toutes les autres features IA. */
    private final AiTokenBudgetService tokenBudgetService;
    /**
     * Routeur d'intention pre-orchestration (T-02, flag
     * {@code clenzy.assistant.routing.enabled}). Null sur le chemin legacy
     * test-only (null-safe : null = routage desactive = comportement historique).
     */
    private final IntentRouter intentRouter;

    /** Constructeur Spring : injection des collaborateurs extraits. */
    @Autowired
    public AgentOrchestrator(ToolRegistry toolRegistry,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              PendingToolStore pendingToolStore,
                              AgentPromptComposer promptComposer,
                              AiTargetResolver targetResolver,
                              AgentToolLoopRunner toolLoopRunner,
                              ConversationHistoryMapper historyMapper,
                              MultiAgentFlowRunner multiAgentFlowRunner,
                              AiTokenBudgetService tokenBudgetService,
                              IntentRouter intentRouter) {
        this.toolRegistry = toolRegistry;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.pendingToolStore = pendingToolStore;
        this.promptComposer = promptComposer;
        this.targetResolver = targetResolver;
        this.toolLoopRunner = toolLoopRunner;
        this.historyMapper = historyMapper;
        this.multiAgentFlowRunner = multiAgentFlowRunner;
        this.tokenBudgetService = tokenBudgetService;
        this.intentRouter = intentRouter;
    }

    /**
     * Constructeur retro-compatible (signature historique pre-extraction des
     * collaborateurs). Conserve pour les tests existants : construit les
     * collaborateurs a partir des dependances unitaires.
     *
     * @deprecated utiliser le constructeur a collaborateurs injectes.
     */
    @Deprecated(since = "2026-06")
    public AgentOrchestrator(ChatLLMProvider chatProvider,
                              ToolRegistry toolRegistry,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              ObjectMapper objectMapper,
                              OrgAiApiKeyRepository orgAiApiKeyRepository,
                              PlatformAiFeatureModelRepository platformAiFeatureModelRepository,
                              PlatformAiFeatureProviderRepository platformAiFeatureProviderRepository,
                              PlatformAiModelRepository platformAiModelRepository,
                              AiProperties aiProperties,
                              PendingToolStore pendingToolStore,
                              AssistantMemoryService memoryService,
                              PhotoStorageService photoStorageService,
                              KbSearchService kbSearchService,
                              com.clenzy.service.agent.prompt.PromptBuilder promptBuilder,
                              com.clenzy.service.agent.multiagent.OrchestratorAgent multiAgentOrchestrator,
                              com.clenzy.service.agent.multiagent.SpecialistRegistry specialistRegistry,
                              com.clenzy.service.AiTokenBudgetService aiTokenBudgetService,
                              com.clenzy.service.PlatformAiConfigService platformAiConfigService,
                              boolean promptV2Enabled,
                              boolean multiAgentEnabled) {
        this(toolRegistry, conversationRepository, messageRepository,
                pendingToolStore,
                new AgentPromptComposer(memoryService, kbSearchService, promptBuilder, promptV2Enabled),
                new AiTargetResolver(orgAiApiKeyRepository, platformAiFeatureModelRepository,
                        platformAiFeatureProviderRepository, platformAiModelRepository, aiProperties),
                // Instrumentation audit/metrics = null sur ce chemin legacy test-only
                // (AgentToolLoopRunner est null-safe). Le chemin Spring @Primary injecte
                // les vrais beans AgentActionAuditService + AgentToolMetrics.
                buildLegacyToolLoopRunner(chatProvider, toolRegistry, messageRepository,
                        pendingToolStore, objectMapper, aiTokenBudgetService),
                new ConversationHistoryMapper(objectMapper, photoStorageService),
                // Flux multi-agent extrait (consolidation #4) : reconstruit ici a partir
                // des dependances unitaires, exactement comme avant l'extraction. Le
                // chemin Spring @Primary injecte le bean MultiAgentFlowRunner.
                new MultiAgentFlowRunner(multiAgentOrchestrator, specialistRegistry,
                        messageRepository, pendingToolStore,
                        buildLegacyToolLoopRunner(chatProvider, toolRegistry, messageRepository,
                                pendingToolStore, objectMapper, aiTokenBudgetService),
                        new AiTargetResolver(orgAiApiKeyRepository, platformAiFeatureModelRepository,
                        platformAiFeatureProviderRepository, platformAiModelRepository, aiProperties),
                        toolRegistry, objectMapper, multiAgentEnabled),
                aiTokenBudgetService,
                // Routage d'intention = null sur ce chemin legacy test-only
                // (null-safe : routage desactive, comportement historique).
                null);
    }

    /**
     * Helper test-only : construit un {@link AgentToolLoopRunner} sans instrumentation
     * audit/metrics (null-safe). Utilise UNIQUEMENT par le constructeur retro-compatible.
     */
    private static AgentToolLoopRunner buildLegacyToolLoopRunner(
            ChatLLMProvider chatProvider, ToolRegistry toolRegistry,
            AssistantMessageRepository messageRepository, PendingToolStore pendingToolStore,
            ObjectMapper objectMapper, com.clenzy.service.AiTokenBudgetService aiTokenBudgetService) {
        return new AgentToolLoopRunner(chatProvider, toolRegistry, messageRepository,
                pendingToolStore, objectMapper, aiTokenBudgetService, null, null);
    }

    /**
     * Lance ou continue une conversation et stream les evenements au consommateur SSE.
     *
     * @param conversationId conversation existante (null = nouvelle)
     * @param userMessage    message texte de l'utilisateur
     * @param context        contexte d'execution (org, user, jwt)
     * @param consumer       callback SSE pour pousser les evenements au frontend
     * @return id de la conversation (utile pour les nouvelles conversations)
     */
    public Long handleMessage(Long conversationId,
                               String userMessage,
                               AgentContext context,
                               Consumer<AgentSseEvent> consumer) {
        return handleMessage(conversationId, userMessage, List.of(), context, consumer);
    }

    /**
     * Variante avec attachments (images uploadees via {@code POST /assistant/upload}).
     * Pour chaque attachment, on stocke la ref JSON sur l'AssistantMessage et on
     * resout les bytes via {@link PhotoStorageService} pour les fournir en base64
     * au LLM (uniquement pour le tour courant — les tours suivants re-resoudront
     * depuis le storage en relisant l'historique).
     */
    public Long handleMessage(Long conversationId,
                               String userMessage,
                               List<AttachmentRef> attachments,
                               AgentContext context,
                               Consumer<AgentSseEvent> consumer) {
        boolean hasAttachments = attachments != null && !attachments.isEmpty();
        if ((userMessage == null || userMessage.isBlank()) && !hasAttachments) {
            throw new IllegalArgumentException("userMessage or attachments required");
        }
        String effectiveMessage = userMessage == null ? "" : userMessage;

        // 1. Resoudre la conversation (creer si null)
        AssistantConversation conversation = resolveOrCreateConversation(conversationId, context);
        if (conversationId == null) {
            consumer.accept(AgentSseEvent.conversationCreated(conversation.getId()));
        }

        // 2. Persister le message user (+ refs attachments JSON si presentes)
        String attachmentsJson = hasAttachments
                ? historyMapper.serializeAttachmentsSafe(attachments)
                : null;
        AssistantMessage userMsg = AssistantMessage.user(
                conversation.getId(), context.organizationId(), effectiveMessage, attachmentsJson);
        messageRepository.save(userMsg);

        // 3. Charger l'historique complet (post-insert du user message)
        List<AssistantMessage> history = messageRepository.findByConversation(conversation.getId());
        List<ChatMessage> chatMessages = historyMapper.toChatMessages(history);

        // 4. Pre-charge memoires + RAG + apiKey UNE SEULE FOIS, partagees entre
        //    multi-agent et mono-agent fallback. Evite la duplication d'appels
        //    Voyage/OpenAI embeddings (~$0.000002 / call) ET de lookups BYOK
        //    quand le multi-agent fallback (ConfirmationRequiredException, throw,
        //    OrchestrationResult.error, etc.).
        List<AssistantMemory> memories = promptComposer.loadMemories(context, effectiveMessage);
        List<KbSearchService.KbSearchHit> kbHits =
                promptComposer.loadRelevantKbHits(effectiveMessage, context.organizationId());
        // Cible LLM resolue UNE SEULE FOIS (provider effectif + modele + cle + baseUrl),
        // partagee entre le flow multi-agent et le fallback mono-agent.
        ResolvedTarget target =
                targetResolver.resolvePrimary(context.organizationId(), AiFeature.ASSISTANT_CHAT, context.modelOverride());
        String apiKey = target.apiKey();

        // 4-bis. Gate ASSISTANT_CHAT : l'assistant respecte le toggle d'activation ET le budget,
        //   comme TOUTES les autres features IA (avant, seul recordUsage était appelé a posteriori →
        //   désactiver la feature ou dépasser le budget n'arrêtait pas l'assistant). S'applique aussi
        //   au superviseur (AgUiController réutilise handleMessage). BYOK exempté du budget (target.source()).
        //   Échec → message gracieux en SSE (le translator AG-UI le rend visible côté superviseur).
        try {
            tokenBudgetService.requireFeatureEnabled(context.organizationId(), AiFeature.ASSISTANT_CHAT);
            tokenBudgetService.requireBudget(context.organizationId(), AiFeature.ASSISTANT_CHAT, target.source());
        } catch (AiNotConfiguredException e) {
            consumer.accept(AgentSseEvent.error(
                    "L'assistant IA est désactivé ou non configuré pour votre organisation. "
                            + "Activez-le dans Paramètres > IA."));
            return conversation.getId();
        } catch (AiBudgetExceededException e) {
            consumer.accept(AgentSseEvent.error(
                    "Le budget IA mensuel de l'assistant est atteint. Augmentez-le dans "
                            + "Paramètres > IA ou réessayez le mois prochain."));
            return conversation.getId();
        }

        // 5-pre. Routage court-circuit (T-02, levier L1) : si le multi-agent est
        //    eligible ET le routage actif, un appel de classification minuscule
        //    (petit prompt, max_tokens=8, T=0) decide si la requete justifie
        //    l'orchestration. SIMPLE/DIRECT → mono-agent directement (un tour
        //    multi coute 5-10x un tour mono). Doute ou erreur → MULTI
        //    (comportement historique, zero regression possible).
        boolean multiAgentEligible = multiAgentFlowRunner.canUse(context, hasAttachments);
        IntentRouter.Route route = null;
        if (multiAgentEligible && intentRouter != null && intentRouter.isEnabled()) {
            IntentRouter.RouteDecision decision = intentRouter.classify(effectiveMessage, target, apiKey);
            toolLoopRunner.recordUsageSafe(context.organizationId(),
                    target.provider(), AgentToolMetrics.AGENT_ROUTER,
                    decision.promptTokens(), decision.completionTokens(), 0,
                    decision.model(), "route");
            route = decision.route();
            if (route != IntentRouter.Route.MULTI) {
                log.info("[ROUTING] Classification {} → court-circuit mono-agent", route);
                multiAgentEligible = false;
            }
        }

        // 5. Tentative multi-agent (si flag on + sans attachments + spécialistes prêts
        //    + routage non court-circuité).
        //    Attachments → fallback mono-agent car les spécialistes ne gerent pas
        //    encore les images Vision (TODO v2).
        //    Pas de spécialiste → impossible, fallback aussi.
        //    Si multi-agent throw, on log et fallback automatiquement.
        if (multiAgentEligible) {
            try {
                com.clenzy.service.agent.multiagent.OrchestrationContext orchestrationCtx =
                        new com.clenzy.service.agent.multiagent.OrchestrationContext(memories, kbHits);
                // Modele + provider + baseUrl resolus (cf. target) propages aux
                // specialists multi-agents via le contexte (routage multi-provider :
                // Anthropic, OpenAI, ou modele plateforme OpenAI-compatible).
                AgentContext effectiveContext = context.withAiTarget(
                        target.model(), target.provider(), target.baseUrl());

                boolean handledByMultiAgent = multiAgentFlowRunner.tryFlow(
                        effectiveMessage, chatMessages, orchestrationCtx, apiKey,
                        effectiveContext, conversation, consumer);
                if (handledByMultiAgent) {
                    // 6. Update conversation updatedAt + title si manquant
                    conversation.setUpdatedAt(LocalDateTime.now());
                    if (conversation.getTitle() == null) {
                        conversation.setTitle(deriveTitle(effectiveMessage));
                    }
                    conversationRepository.save(conversation);
                    return conversation.getId();
                }
            } catch (com.clenzy.service.agent.multiagent.ConfirmationRequiredException e) {
                // Cas attendu : un specialist a tente d'invoquer un write tool
                // sensible (block_calendar, cancel_reservation, etc.). Le multi-agent
                // ne sait pas faire la pause-confirmation → fallback mono-agent
                // qui exposera la confirmation au user. Log info, pas warn.
                //
                // NB: les eventuels widgets/snapshots accumules par le specialist
                // AVANT le throw (read tools precedents) sont volontairement perdus :
                // ils n'avaient pas encore ete emis en SSE (l'emission ne se fait qu'a
                // la fin de MultiAgentFlowRunner.tryFlow), et le mono-agent va de toute facon
                // re-invoquer ses propres tools → pas de risque de duplicate ni
                // d'incohérence.
                log.info("Multi-agent fallback to mono-agent (tool '{}' requires confirmation)",
                        e.toolName());
            } catch (Exception e) {
                log.warn("Multi-agent flow failed, falling back to mono-agent : {}",
                        e.getMessage(), e);
            }
        }

        // 7 (fallback). Boucle tool-calling mono-agent, avec reutilisation des memoires
        //    + RAG pre-chargees (pas de second appel embeddings).
        //    Resolution du modele (priorite decroissante) :
        //      1. context.modelOverride() : forcage explicite (briefings = Haiku)
        //      2. Modele assigne a la feature ASSISTANT_CHAT dans Settings > IA
        //      3. null → defaut provider (Anthropic Sonnet)
        // Deux reductions de contexte sur la liste d'outils envoyee a CHAQUE appel LLM :
        //   - RBAC least-privilege (RoleToolPolicy) : un role operationnel ne voit que
        //     ses outils d'intervention.
        //   - Scoping par pertinence (ToolScopeSelector) : socle transverse + outils du
        //     domaine detecte dans la requete, au lieu des ~60 outils du catalogue complet.
        List<ToolDescriptor> roleTools = RoleToolPolicy.filterForRole(toolRegistry.listDescriptors(), context);
        // Route DIRECT (smalltalk/meta, T-02) : aucun outil necessaire → on economise
        // aussi les definitions d'outils (~2-6k tokens par appel).
        List<ToolDescriptor> tools = (route == IntentRouter.Route.DIRECT)
                ? List.of()
                : ToolScopeSelector.select(roleTools, chatMessages);
        ComposedSystemPrompt systemPrompt =
                promptComposer.buildSegmentedSystemPrompt(context, effectiveMessage, memories, kbHits);
        ChatRequest request = new ChatRequest(
                systemPrompt.cacheablePrefix(), chatMessages, tools, target.model(),
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN, systemPrompt.volatileSuffix(),
                target.provider(), target.baseUrl());

        toolLoopRunner.runToolLoop(request, conversation, context, apiKey, consumer);

        // 5. Update conversation updatedAt + title si manquant
        conversation.setUpdatedAt(LocalDateTime.now());
        if (conversation.getTitle() == null) {
            conversation.setTitle(deriveTitle(effectiveMessage.isBlank() ? "Photos" : effectiveMessage));
        }
        conversationRepository.save(conversation);

        return conversation.getId();
    }

    /**
     * Reprise apres confirmation/refus utilisateur sur un tool requiresConfirmation.
     *
     * <p>Si {@code confirmed=true} : execute le tool, persiste le resultat, et
     * relance la boucle LLM avec le resultat. Si {@code confirmed=false} : ecrit
     * un tool result "annule par l'utilisateur" et relance le LLM pour qu'il
     * formule une reponse "ok, j'ai annule".</p>
     *
     * @param toolCallId id du tool en attente
     * @param confirmed  decision user
     * @param context    contexte courant (peut differer de celui au moment de la pause)
     * @param consumer   callback SSE pour stream la suite
     * @return id de la conversation reprise
     */
    public Long resumeAfterConfirmation(String toolCallId,
                                         boolean confirmed,
                                         AgentContext context,
                                         Consumer<AgentSseEvent> consumer) {
        PendingToolStore.PendingTool pending = pendingToolStore
                .consume(toolCallId, context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Tool en attente " + toolCallId + " introuvable / expire / non autorise"));

        // Recharger la conv pour update updatedAt en fin de boucle. La validation
        // d'ownership est double : consume() (keycloakId du pending) + findByIdAndUser
        // (conversation scopee au user).
        AssistantConversation conversation = conversationRepository
                .findByIdAndUser(pending.conversationId(), context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + pending.conversationId() + " introuvable"));

        // Construire le tool result : execution reelle OU "annule par user".
        // Partage entre les deux flux (mono + multi-agent).
        ToolResult result = confirmed
                ? toolLoopRunner.executeConfirmed(pending, context)
                : ToolResult.error("L'utilisateur a refuse l'execution de cette action.");

        consumer.accept(AgentSseEvent.toolCallExecuted(
                pending.toolName(), pending.toolCallId(),
                result.isError(), result.displayHint(),
                result.isError() ? null : result.content()));

        // Persister le tool result
        AssistantMessage toolMsg = AssistantMessage.tool(
                conversation.getId(), context.organizationId(),
                pending.toolCallId(), result.content());
        messageRepository.save(toolMsg);

        // ─── Branche HITL multi-agent : re-entrer dans le flow multi-agent ───
        if (pending.isMultiAgent()) {
            multiAgentFlowRunner.resumeAfterConfirmation(pending, result, context, conversation, consumer);
            conversation.setUpdatedAt(LocalDateTime.now());
            conversationRepository.save(conversation);
            return conversation.getId();
        }

        // ─── Branche mono-agent (inchangée) ───
        // Construire le ChatRequest a partir de l'historique stocke + tool result
        List<ChatMessage> messages = new ArrayList<>(pending.pendingHistory());
        messages.add(ChatMessage.tool(pending.toolCallId(), result.content()));

        ComposedSystemPrompt resumeSystem = promptComposer.buildSegmentedSystemPrompt(context);
        ResolvedTarget target =
                targetResolver.resolvePrimary(context.organizationId(), AiFeature.ASSISTANT_CHAT, context.modelOverride());
        ChatRequest request = new ChatRequest(
                resumeSystem.cacheablePrefix(), messages,
                ToolScopeSelector.select(
                        RoleToolPolicy.filterForRole(toolRegistry.listDescriptors(), context), messages),
                target.model() != null ? target.model() : conversation.getModel(),
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN, resumeSystem.volatileSuffix(),
                target.provider(), target.baseUrl());

        toolLoopRunner.runToolLoop(request, conversation, context, target.apiKey(), consumer);

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return conversation.getId();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    /**
     * Construit le system prompt pour cette conversation (delegue a
     * {@link AgentPromptComposer}).
     *
     * <p>Variante sans userMessage : utilisee dans les resume-after-confirmation
     * (pas de nouvelle query memoire/RAG).</p>
     */
    String buildSystemPrompt(AgentContext context) {
        return promptComposer.buildSegmentedSystemPrompt(context).full();
    }

    /**
     * Variante avec userMessage : selection memoire par similarite + RAG
     * auto-injection (delegue a {@link AgentPromptComposer}).
     */
    String buildSystemPrompt(AgentContext context, String latestUserMessage) {
        return promptComposer.buildSegmentedSystemPrompt(context, latestUserMessage).full();
    }

    private AssistantConversation resolveOrCreateConversation(Long id, AgentContext ctx) {
        if (id == null) {
            return conversationRepository.save(
                    new AssistantConversation(ctx.organizationId(), ctx.keycloakId()));
        }
        return conversationRepository.findByIdAndUser(id, ctx.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));
    }

    private String deriveTitle(String firstMessage) {
        if (firstMessage == null) return null;
        String trimmed = firstMessage.strip().replaceAll("\\s+", " ");
        if (trimmed.length() <= 60) return trimmed;
        return trimmed.substring(0, 57) + "...";
    }
}
