package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Iterator;
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
 */
@Service
public class AgentOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AgentOrchestrator.class);
    private static final int MAX_TOOL_ITERATIONS = 5;
    private static final int MAX_TOKENS_PER_TURN = 4096;
    private static final double DEFAULT_TEMPERATURE = 0.3;
    private static final String DEFAULT_SYSTEM_PROMPT = """
            Tu es l'assistant strategique Clenzy, un PMS (Property Management System) pour la
            location courte duree. Ton role : aider l'utilisateur a COMPRENDRE ses donnees,
            CONSEILLER une strategie, et le GUIDER dans le PMS via des liens cliquables.

            Tu es plus qu'un chatbot : tu es un copilote business. Tu interpretes les insights,
            tu pose des questions de clarification quand utile, tu suggeres des actions concretes.

            Regles de communication :
            - Reponds toujours en francais, ton conversationnel mais professionnel.
            - Markdown autorise : **gras**, *italique*, listes a puces, liens [texte](/route).
            - Format des dates en francais : "12 juin 2026" plutot que "2026-06-12" dans le texte.
            - Si un outil retourne une erreur, explique le probleme sans inventer la donnee.

            IMPORTANT — Rendu visuel automatique des donnees :
            - Quand un outil retourne des donnees structurees (KPIs, listes, graphiques, insights),
              le frontend affiche AUTOMATIQUEMENT un widget visuel au-dessus de ton texte.
            - Ne reproduis donc PAS les donnees brutes (pas de tableau markdown, pas de liste
              exhaustive d'items, pas de pourcentages que le pie chart affiche deja).
            - Limite-toi a un COMMENTAIRE strategique (2-4 phrases) qui :
              * synthetise l'insight cle ("le pic est en juillet", "3 alertes critiques")
              * POSE des questions ou suggere des actions ("veux-tu qu'on regarde X ?", "tu devrais Y")
              * propose un lien vers la bonne section du PMS via suggest_navigation
            - Exemple : "Tu as 12 reservations cette semaine, dont 3 a Paris. Le pic est jeudi.
              Tu veux que je verifie si tes menages sont bien planifies pour ces jours-la ?"

            ─── Catalogue d'outils ─────────────────────────────────────────────

            DONNEES (read-only) :
            - get_dashboard_summary → KPI plateforme (uptime, double bookings, etc.)
            - list_properties / list_reservations / list_cleaning_tasks → tables
            - get_interventions_by_status → pie chart distribution statuts
            - get_reservation_trend → line chart N mois evolution reservations
            - get_financial_summary → bar chart revenus/depenses/profit par mois
            - get_properties_performance → bar chart top N proprietes (revenus + interventions)

            STRATEGIQUE (AI-powered) :
            - get_business_insights(propertyId) → liste d'insights AI (anomalies, recommandations,
              warnings, tendances) pour UNE propriete. Tu DOIS interpreter chaque insight et
              proposer une strategie globale a l'utilisateur, pas juste lire.
            - get_occupancy_forecast(propertyId, days) → prevision occupation N jours.
              Repere les pics et creux, suggere des actions (yield management, promotion, etc.).

            ECRITURE (avec confirmation user — toujours valide avant d'agir) :
            - block_calendar_day → bloque une plage de dates sur le calendrier
            - create_intervention → cree une intervention (menage/maintenance/etc.) sur une propriete
            - assign_intervention → assigne une intervention a un user OU une team
            - cancel_reservation → annule une reservation (irreversible)
            - update_property_status → change statut propriete (ACTIVE/INACTIVE/UNDER_MAINTENANCE/ARCHIVED)
            - send_guest_message → envoie un message via template au guest d'une reservation

            NAVIGATION (guide l'utilisateur dans le PMS) :
            - suggest_navigation(path, label, reason) → produit un BOUTON CLIQUABLE qui amene
              l'utilisateur sur la bonne page du PMS. Utilise-le proactivement quand :
              * l'utilisateur demande "ou puis-je", "comment configurer", "ou trouver"
              * tu suggeres une action qui necessite d'aller ailleurs
              * apres avoir presente un insight qui appelle un parametrage

            ─── Carte des routes PMS (pour suggest_navigation) ─────────────────

            Operations :
              /planning            Calendrier multi-proprietes (vue d'ensemble drag&drop)
              /dashboard           Tableau de bord KPI quotidiens
              /properties          Gestion des proprietes (ajout, edition, photos, amenities)
              /interventions       Menages + maintenance + check-in/out
              /reservations        Liste des reservations
              /directory           Annuaire (equipes, prestataires, guests)

            Pilotage :
              /reports             Rapports detailles (Financier, Operationnel, Equipes, Proprietes)
              /reports?tab=financial    Bilan financier
              /reports?tab=interventions Reports operationnels
              /reports?tab=teams        Performance equipes
              /reports?tab=properties   Performance proprietes

            Revenue :
              /tarification        Pricing dynamique (regles, seasonalite, last-minute)
              /billing             Paiements, factures, payouts proprietaires
              /contracts           Contrats de gestion / mandats
              /channels            Connexions Airbnb / Booking / Vrbo / iCal
              /booking-engine      Widget direct sans commission

            Communication :
              /contact             Messages guests (email/SMS/WhatsApp)
              /documents           Templates documents (devis, factures, contrats)

            Configuration :
              /settings            Parametres globaux
              /settings?tab=ai     Configuration IA (cles BYOK, modeles, features ON/OFF)
              /settings?tab=notifications  Preferences notifications
              /settings?tab=organization   Profil organisation

            Admin (super-admin uniquement) :
              /monitoring          Monitoring infra (KPI tech, services)
              /shop                Boutique d'options et upsells

            Exemples d'usage de suggest_navigation :
            - Question : "comment activer l'IA analytics ?" → suggest_navigation(
                path="/settings?tab=ai", label="Parametres IA", reason="Active analyticsAi ici")
            - Apres insight "ton ADR est sous le marche" → suggest_navigation(
                path="/tarification", label="Ajuster la tarification",
                reason="Configure les regles de pricing dynamique")
            - Question "ou voir mes revenus mensuels" → suggest_navigation(
                path="/reports?tab=financial", label="Rapport financier",
                reason="Vue detaillee mensuelle des revenus et depenses")

            Tu peux appeler PLUSIEURS outils en chaine si necessaire (ex: get_business_insights
            pour l'analyse, puis suggest_navigation pour la CTA).
            """;

    private final ChatLLMProvider chatProvider;
    private final ToolRegistry toolRegistry;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final ObjectMapper objectMapper;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final AiProperties aiProperties;
    private final PendingToolStore pendingToolStore;

    public AgentOrchestrator(ChatLLMProvider chatProvider,
                              ToolRegistry toolRegistry,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              ObjectMapper objectMapper,
                              OrgAiApiKeyRepository orgAiApiKeyRepository,
                              AiProperties aiProperties,
                              PendingToolStore pendingToolStore) {
        this.chatProvider = chatProvider;
        this.toolRegistry = toolRegistry;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.objectMapper = objectMapper;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.aiProperties = aiProperties;
        this.pendingToolStore = pendingToolStore;
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
        if (userMessage == null || userMessage.isBlank()) {
            throw new IllegalArgumentException("userMessage cannot be blank");
        }

        // 1. Resoudre la conversation (creer si null)
        AssistantConversation conversation = resolveOrCreateConversation(conversationId, context);
        if (conversationId == null) {
            consumer.accept(AgentSseEvent.conversationCreated(conversation.getId()));
        }

        // 2. Persister le message user
        AssistantMessage userMsg = AssistantMessage.user(
                conversation.getId(), context.organizationId(), userMessage);
        messageRepository.save(userMsg);

        // 3. Charger l'historique complet (post-insert du user message)
        List<AssistantMessage> history = messageRepository.findByConversation(conversation.getId());
        List<ChatMessage> chatMessages = toChatMessages(history);

        // 4. Boucle tool-calling
        String apiKey = resolveApiKey(context.organizationId());
        List<ToolDescriptor> tools = toolRegistry.listDescriptors();
        ChatRequest request = new ChatRequest(
                DEFAULT_SYSTEM_PROMPT, chatMessages, tools, null,
                DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN);

        runToolLoop(request, conversation, context, apiKey, consumer);

        // 5. Update conversation updatedAt + title si manquant
        conversation.setUpdatedAt(LocalDateTime.now());
        if (conversation.getTitle() == null) {
            conversation.setTitle(deriveTitle(userMessage));
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

        // Recharger la conv pour update updatedAt en fin de boucle
        AssistantConversation conversation = conversationRepository
                .findByIdAndUser(pending.conversationId(), context.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + pending.conversationId() + " introuvable"));

        // Construire le tool result : execution reelle OU "annule par user"
        ToolResult result;
        if (confirmed) {
            Optional<ToolHandler> handler = toolRegistry.find(pending.toolName());
            if (handler.isEmpty()) {
                result = ToolResult.error("Tool '" + pending.toolName() + "' n'est plus disponible");
            } else {
                try {
                    JsonNode args = parseArgsSafe(pending.argsJson());
                    result = handler.get().execute(args, context);
                } catch (ToolExecutionException e) {
                    log.info("Tool '{}' a echoue apres confirmation : {}", pending.toolName(), e.getMessage());
                    result = ToolResult.error(e.getMessage());
                } catch (Exception e) {
                    log.error("Tool '{}' exception inattendue apres confirmation", pending.toolName(), e);
                    result = ToolResult.error("Erreur interne lors de l'execution de " + pending.toolName());
                }
            }
        } else {
            result = ToolResult.error("L'utilisateur a refuse l'execution de cette action.");
        }

        consumer.accept(AgentSseEvent.toolCallExecuted(
                pending.toolName(), pending.toolCallId(),
                result.isError(), result.displayHint(),
                result.isError() ? null : result.content()));

        // Persister le tool result
        AssistantMessage toolMsg = AssistantMessage.tool(
                conversation.getId(), context.organizationId(),
                pending.toolCallId(), result.content());
        messageRepository.save(toolMsg);

        // Construire le ChatRequest a partir de l'historique stocke + tool result
        List<ChatMessage> messages = new ArrayList<>(pending.pendingHistory());
        messages.add(ChatMessage.tool(pending.toolCallId(), result.content()));

        ChatRequest request = new ChatRequest(
                DEFAULT_SYSTEM_PROMPT, messages, toolRegistry.listDescriptors(),
                conversation.getModel(), DEFAULT_TEMPERATURE, MAX_TOKENS_PER_TURN);

        String apiKey = resolveApiKey(context.organizationId());
        runToolLoop(request, conversation, context, apiKey, consumer);

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return conversation.getId();
    }

    // ─── Boucle principale ─────────────────────────────────────────────────

    private void runToolLoop(ChatRequest initialRequest,
                              AssistantConversation conversation,
                              AgentContext context,
                              String apiKey,
                              Consumer<AgentSseEvent> consumer) {
        ChatRequest request = initialRequest;

        for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            LoopOutcome outcome = streamOneTurn(request, conversation, apiKey, consumer);

            if (outcome.error != null) {
                consumer.accept(AgentSseEvent.error(outcome.error));
                return;
            }

            // Persist assistant message (text + tool_calls)
            AssistantMessage assistantMsg = AssistantMessage.assistant(
                    conversation.getId(),
                    context.organizationId(),
                    outcome.text == null ? "" : outcome.text,
                    serializeToolCallsSafe(outcome.toolCalls));
            assistantMsg.setPromptTokens(outcome.promptTokens);
            assistantMsg.setCompletionTokens(outcome.completionTokens);
            assistantMsg.setFinishReason(outcome.finishReason);
            messageRepository.save(assistantMsg);

            if (conversation.getModel() == null && outcome.model != null) {
                conversation.setModel(outcome.model);
            }

            // No tool calls → done
            if (outcome.toolCalls == null || outcome.toolCalls.isEmpty()) {
                consumer.accept(AgentSseEvent.done(outcome.finishReason));
                return;
            }

            // Check if any tool requires confirmation → suspend
            for (ChatMessage.ToolCall call : outcome.toolCalls) {
                Optional<ToolHandler> handler = toolRegistry.find(call.name());
                if (handler.isPresent()
                        && handler.get().descriptor() != null
                        && handler.get().descriptor().requiresConfirmation()) {
                    // Build the "future history" : current request + this assistant turn
                    // (avec TOUS les tool_calls). Quand le user confirme/refuse, on
                    // appendera les tool results et reprendre la boucle.
                    List<ChatMessage> futureHistory = new ArrayList<>(request.messages());
                    futureHistory.add(ChatMessage.assistantToolCalls(outcome.toolCalls));

                    pendingToolStore.put(
                            call.id(),
                            conversation.getId(),
                            context.organizationId(),
                            context.keycloakId(),
                            call.name(),
                            call.arguments(),
                            futureHistory
                    );

                    String description = handler.get().descriptor().description();
                    consumer.accept(AgentSseEvent.toolConfirmationRequest(
                            call.name(), call.id(), call.arguments(), description));
                    // Si plusieurs tools sont en confirmation, on les annonce tous —
                    // le frontend pourra les afficher et envoyer confirm pour chacun.
                }
            }

            // Si au moins UN tool requiresConfirmation, on suspend la boucle complete.
            // Les tools read-only (s'il y en a dans le meme tour) ne sont PAS executes
            // pour eviter une execution partielle ambigue.
            boolean anyRequiresConfirm = outcome.toolCalls.stream().anyMatch(c -> {
                Optional<ToolHandler> h = toolRegistry.find(c.name());
                return h.isPresent() && h.get().descriptor() != null
                        && h.get().descriptor().requiresConfirmation();
            });
            if (anyRequiresConfirm) {
                consumer.accept(AgentSseEvent.pausedAwaitingConfirmation());
                return;
            }

            // Execute each tool, persist result, push SSE
            List<ChatMessage> toolResults = new ArrayList<>();
            for (ChatMessage.ToolCall call : outcome.toolCalls) {
                ToolResult result = executeTool(call, context);
                consumer.accept(AgentSseEvent.toolCallExecuted(call.name(), call.id(),
                        result.isError(), result.displayHint(),
                        result.isError() ? null : result.content()));

                AssistantMessage toolMsg = AssistantMessage.tool(
                        conversation.getId(), context.organizationId(),
                        call.id(), result.content());
                messageRepository.save(toolMsg);

                toolResults.add(ChatMessage.tool(call.id(), result.content()));
            }

            // Build next request : current request + assistant turn + tool results
            ChatRequest next = request.withAppendedMessage(
                    ChatMessage.assistantToolCalls(outcome.toolCalls));
            for (ChatMessage tr : toolResults) {
                next = next.withAppendedMessage(tr);
            }
            request = next;
        }

        // Hit iteration cap
        consumer.accept(AgentSseEvent.error(
                "Trop d'iterations d'outils (>" + MAX_TOOL_ITERATIONS + "). Reformule ta demande."));
    }

    private LoopOutcome streamOneTurn(ChatRequest request,
                                       AssistantConversation conversation,
                                       String apiKey,
                                       Consumer<AgentSseEvent> consumer) {
        LoopOutcome outcome = new LoopOutcome();

        Consumer<ChatEvent> handler = event -> {
            if (event instanceof ChatEvent.TextDelta td) {
                consumer.accept(AgentSseEvent.textDelta(td.delta()));
            } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                outcome.toolCalls = new ArrayList<>(tcr.calls());
            } else if (event instanceof ChatEvent.Done done) {
                outcome.text = done.fullText();
                outcome.promptTokens = done.promptTokens();
                outcome.completionTokens = done.completionTokens();
                outcome.model = done.model();
                outcome.finishReason = done.finishReason();
            } else if (event instanceof ChatEvent.Error err) {
                outcome.error = err.message();
            }
        };

        if (apiKey != null) {
            chatProvider.streamChat(request, handler, apiKey);
        } else {
            chatProvider.streamChat(request, handler);
        }
        return outcome;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private AssistantConversation resolveOrCreateConversation(Long id, AgentContext ctx) {
        if (id == null) {
            return conversationRepository.save(
                    new AssistantConversation(ctx.organizationId(), ctx.keycloakId()));
        }
        return conversationRepository.findByIdAndUser(id, ctx.keycloakId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));
    }

    private String resolveApiKey(Long organizationId) {
        try {
            Optional<OrgAiApiKey> byokKey = orgAiApiKeyRepository
                    .findByOrganizationIdAndProvider(organizationId, "anthropic");
            if (byokKey.isPresent() && byokKey.get().isValid()
                    && byokKey.get().getApiKey() != null && !byokKey.get().getApiKey().isBlank()) {
                return byokKey.get().getApiKey();
            }
        } catch (Exception e) {
            log.debug("Pas de cle BYOK Anthropic pour org {} ({}), fallback plateforme",
                    organizationId, e.getMessage());
        }
        // null => le provider utilisera la cle plateforme via la signature sans apiKey
        return null;
    }

    private List<ChatMessage> toChatMessages(List<AssistantMessage> history) {
        List<ChatMessage> result = new ArrayList<>();
        Iterator<AssistantMessage> it = history.iterator();
        while (it.hasNext()) {
            AssistantMessage m = it.next();
            switch (m.getRole()) {
                case AssistantMessage.ROLE_USER ->
                        result.add(ChatMessage.user(m.getContent() != null ? m.getContent() : ""));
                case AssistantMessage.ROLE_ASSISTANT -> {
                    List<ChatMessage.ToolCall> calls = parseToolCallsSafe(m.getToolCalls());
                    if (!calls.isEmpty()) {
                        result.add(ChatMessage.assistantToolCalls(calls));
                    } else {
                        result.add(ChatMessage.assistant(m.getContent() != null ? m.getContent() : ""));
                    }
                }
                case AssistantMessage.ROLE_TOOL ->
                        result.add(ChatMessage.tool(m.getToolCallId(),
                                m.getContent() != null ? m.getContent() : ""));
                default -> log.warn("Role inconnu dans l'historique : {}", m.getRole());
            }
        }
        return result;
    }

    private ToolResult executeTool(ChatMessage.ToolCall call, AgentContext context) {
        Optional<ToolHandler> handler = toolRegistry.find(call.name());
        if (handler.isEmpty()) {
            log.warn("Tool '{}' inconnu (demande par le LLM)", call.name());
            return ToolResult.error("Tool '" + call.name() + "' non disponible");
        }
        try {
            JsonNode args = parseArgsSafe(call.arguments());
            return handler.get().execute(args, context);
        } catch (ToolExecutionException e) {
            log.info("Tool '{}' a echoue (previsible) : {}", call.name(), e.getMessage());
            return ToolResult.error(e.getMessage());
        } catch (Exception e) {
            log.error("Tool '{}' a leve une exception inattendue", call.name(), e);
            return ToolResult.error("Erreur interne lors de l'execution de " + call.name());
        }
    }

    private JsonNode parseArgsSafe(String json) {
        if (json == null || json.isBlank()) return objectMapper.createObjectNode();
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            log.warn("Tool args JSON invalide, fallback objet vide : {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private List<ChatMessage.ToolCall> parseToolCallsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return List.of();
            List<ChatMessage.ToolCall> out = new ArrayList<>(arr.size());
            for (JsonNode node : arr) {
                String id = node.path("id").asText(null);
                String name = node.path("name").asText(null);
                String args = node.path("arguments").asText("{}");
                if (id != null && name != null) {
                    out.add(new ChatMessage.ToolCall(id, name, args));
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("Failed to parse persisted tool_calls JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String serializeToolCallsSafe(List<ChatMessage.ToolCall> calls) {
        if (calls == null || calls.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(calls);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize tool_calls : {}", e.getMessage());
            return null;
        }
    }

    private String deriveTitle(String firstMessage) {
        if (firstMessage == null) return null;
        String trimmed = firstMessage.strip().replaceAll("\\s+", " ");
        if (trimmed.length() <= 60) return trimmed;
        return trimmed.substring(0, 57) + "...";
    }

    // ─── State holder for one LLM turn ─────────────────────────────────────

    private static final class LoopOutcome {
        String text;
        List<ChatMessage.ToolCall> toolCalls;
        int promptTokens;
        int completionTokens;
        String model;
        String finishReason;
        String error;
    }
}
