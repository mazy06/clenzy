package com.clenzy.service.agent;

import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.AiTokenBudgetService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Boucle tool-calling mono-agent de l'assistant : a chaque tour, stream un appel
 * LLM, persiste le message assistant, execute les tools demandes (ou suspend la
 * boucle si un tool requiert une confirmation user), puis rappelle le LLM avec
 * les resultats — jusqu'a une reponse texte ou {@link #MAX_TOOL_ITERATIONS}.
 *
 * <p>Extrait de {@code AgentOrchestrator} (refactor SRP) — comportement strictement
 * identique : memes events SSE, meme persistance, meme tracking usage.</p>
 */
@Component
public class AgentToolLoopRunner {

    private static final Logger log = LoggerFactory.getLogger(AgentToolLoopRunner.class);
    private static final int MAX_TOOL_ITERATIONS = 4;

    private final ChatLLMProvider chatProvider;
    private final ToolRegistry toolRegistry;
    private final AssistantMessageRepository messageRepository;
    private final PendingToolStore pendingToolStore;
    private final ObjectMapper objectMapper;
    private final AiTokenBudgetService aiTokenBudgetService;
    private final AgentActionAuditService actionAuditService;
    private final AgentToolMetrics toolMetrics;

    public AgentToolLoopRunner(ChatLLMProvider chatProvider,
                                ToolRegistry toolRegistry,
                                AssistantMessageRepository messageRepository,
                                PendingToolStore pendingToolStore,
                                ObjectMapper objectMapper,
                                AiTokenBudgetService aiTokenBudgetService,
                                AgentActionAuditService actionAuditService,
                                AgentToolMetrics toolMetrics) {
        this.chatProvider = chatProvider;
        this.toolRegistry = toolRegistry;
        this.messageRepository = messageRepository;
        this.pendingToolStore = pendingToolStore;
        this.objectMapper = objectMapper;
        this.aiTokenBudgetService = aiTokenBudgetService;
        this.actionAuditService = actionAuditService;
        this.toolMetrics = toolMetrics;
    }

    public void runToolLoop(ChatRequest initialRequest,
                              AssistantConversation conversation,
                              AgentContext context,
                              String apiKey,
                              Consumer<AgentSseEvent> consumer) {
        ChatRequest request = initialRequest;

        for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            LoopOutcome outcome = streamOneTurn(request, apiKey, consumer);

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

            // Modèle RÉELLEMENT utilisé = celui envoyé (request.model()) ; outcome.model peut
            // retomber sur un défaut ('claude-sonnet-4') si le stream ne le renvoie pas
            // → sinon coût FAUX dans la vue Consommation (prix Claude sur du gpt-5-mini).
            String usedModel = (request.model() != null && !request.model().isBlank())
                    ? request.model() : outcome.model;

            if (conversation.getModel() == null && usedModel != null) {
                conversation.setModel(usedModel);
            }

            // Track usage : alimente ai_token_usage pour le badge frontend
            // "$0.12 ce mois" + alertes budget. Granularite = par iteration LLM
            // (1 record par tool call round, pour matcher la realite des couts).
            if (outcome.cachedPromptTokens > 0) {
                log.info("[USAGE] Cache hit : {} tokens caches → {} tokens factures (prompt)",
                        outcome.cachedPromptTokens, outcome.promptTokens);
            }
            recordUsageSafe(context.organizationId(),
                    request.provider() != null ? request.provider() : "anthropic",
                    AgentToolMetrics.AGENT_MONO,
                    outcome.promptTokens, outcome.completionTokens, outcome.cachedPromptTokens,
                    usedModel, outcome.finishReason);

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

                    String description = handler.get().descriptor().description();
                    pendingToolStore.put(
                            call.id(),
                            conversation.getId(),
                            context.organizationId(),
                            context.keycloakId(),
                            call.name(),
                            call.arguments(),
                            futureHistory,
                            null,
                            description
                    );

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

                // Copie ENVOYÉE au LLM : tronquée si volumineuse (lever #2). La copie
                // persistée ci-dessus et le widget frontend restent complets.
                toolResults.add(ChatMessage.tool(call.id(), ContextBudget.capToolResult(result.content())));
            }

            // Build next request : current request + assistant turn + tool results
            ChatRequest next = request.withAppendedMessage(
                    ChatMessage.assistantToolCalls(outcome.toolCalls));
            for (ChatMessage tr : toolResults) {
                next = next.withAppendedMessage(tr);
            }
            request = next;
        }

        // Plafond d'iterations atteint : repli GRACIEUX (au lieu d'une erreur dure qui
        // perdait tout le travail collecte). On force un DERNIER tour SANS outils pour que
        // le modele synthetise une reponse a partir des resultats deja obtenus.
        log.info("Cap d'iterations atteint ({}) — tour final sans outils pour synthese",
                MAX_TOOL_ITERATIONS);
        LoopOutcome finalOutcome = streamOneTurn(request.withoutTools(), apiKey, consumer);
        if (finalOutcome.error != null) {
            consumer.accept(AgentSseEvent.error(finalOutcome.error));
            return;
        }
        AssistantMessage finalMsg = AssistantMessage.assistant(
                conversation.getId(), context.organizationId(),
                finalOutcome.text == null ? "" : finalOutcome.text, null);
        finalMsg.setPromptTokens(finalOutcome.promptTokens);
        finalMsg.setCompletionTokens(finalOutcome.completionTokens);
        finalMsg.setFinishReason(finalOutcome.finishReason);
        messageRepository.save(finalMsg);

        String finalModel = (request.model() != null && !request.model().isBlank())
                ? request.model() : finalOutcome.model;
        recordUsageSafe(context.organizationId(),
                request.provider() != null ? request.provider() : "anthropic",
                AgentToolMetrics.AGENT_MONO,
                finalOutcome.promptTokens, finalOutcome.completionTokens,
                finalOutcome.cachedPromptTokens,
                finalModel, finalOutcome.finishReason);
        consumer.accept(AgentSseEvent.done(
                finalOutcome.finishReason != null ? finalOutcome.finishReason : "stop"));
    }

    /**
     * Execute un tool confirme par l'utilisateur (reprise apres pause-confirmation).
     * Messages d'erreur distincts du flow nominal ("n'est plus disponible",
     * "apres confirmation") — conserves a l'identique.
     */
    public ToolResult executeConfirmed(PendingToolStore.PendingTool pending, AgentContext context) {
        Optional<ToolHandler> handler = toolRegistry.find(pending.toolName());
        if (handler.isEmpty()) {
            recordMetric(pending.toolName(), false);
            return ToolResult.error("Tool '" + pending.toolName() + "' n'est plus disponible");
        }
        // Un tool confirme est par construction un WRITE tool (requiresConfirmation) :
        // on l'audite systematiquement (priorite absolue — modification de donnees).
        boolean isWrite = handler.get().descriptor() == null
                || handler.get().descriptor().requiresConfirmation();
        try {
            JsonNode args = parseArgsSafe(pending.argsJson());
            ToolResult result = handler.get().execute(args, context);
            boolean success = !result.isError();
            recordMetric(pending.toolName(), success);
            recordAudit(pending.toolName(), pending.argsJson(), isWrite, success, context);
            return result;
        } catch (ToolExecutionException e) {
            log.info("Tool '{}' a echoue apres confirmation : {}", pending.toolName(), e.getMessage());
            recordMetric(pending.toolName(), false);
            recordAudit(pending.toolName(), pending.argsJson(), isWrite, false, context);
            return ToolResult.error(e.getMessage());
        } catch (Exception e) {
            log.error("Tool '{}' exception inattendue apres confirmation", pending.toolName(), e);
            recordMetric(pending.toolName(), false);
            recordAudit(pending.toolName(), pending.argsJson(), isWrite, false, context);
            return ToolResult.error("Erreur interne lors de l'execution de " + pending.toolName());
        }
    }

    /**
     * Enregistre la consommation tokens dans {@code ai_token_usage} (feature
     * {@code ASSISTANT_CHAT}) + expose les metriques Grafana (tokens, cout USD,
     * cache — T-01). Wrappee defensivement : ne propage JAMAIS d'exception au
     * caller — un crash du tracking ne doit pas casser le chat.
     *
     * <p>Skip si tokens = 0 ou modele = null (rien d'utile a tracker).</p>
     *
     * @param agent              origine de l'appel pour le tag metrique —
     *                           {@link AgentToolMetrics#AGENT_MONO} ou
     *                           {@link AgentToolMetrics#AGENT_MULTI}
     * @param cachedPromptTokens tokens d'entree servis depuis le cache provider
     *                           (metrique seulement, deja deduits du facture)
     */
    public void recordUsageSafe(Long organizationId, String providerName, String agent,
                                   int promptTokens, int completionTokens, int cachedPromptTokens,
                                   String model, String finishReason) {
        if (promptTokens <= 0 && completionTokens <= 0) {
            log.info("[USAGE] Skip recordUsage : tokens={}/{} model='{}' (zero)",
                    promptTokens, completionTokens, model);
            return;
        }
        if (model == null || model.isBlank()) {
            log.info("[USAGE] Skip recordUsage : model null/blank, tokens={}/{}",
                    promptTokens, completionTokens);
            return;
        }
        try {
            AiResponse resp = new AiResponse(
                    "",  // content non requis pour le tracking
                    promptTokens, completionTokens,
                    promptTokens + completionTokens,
                    model,
                    finishReason
            );
            aiTokenBudgetService.recordUsage(
                    organizationId,
                    AiFeature.ASSISTANT_CHAT,
                    providerName != null ? providerName : "anthropic",
                    resp
            );
            // Exposition Grafana : tokens (prompt facture/completion/cache), cout USD,
            // detection modele sans tarif (metrique seulement, pas de persistance).
            if (toolMetrics != null) {
                toolMetrics.recordLlmUsage(providerName, model, agent,
                        promptTokens, completionTokens, cachedPromptTokens);
            }
            log.info("[USAGE] Recorded ASSISTANT_CHAT : org={} provider={} model='{}' "
                    + "tokens={}/{}", organizationId, providerName, model,
                    promptTokens, completionTokens);
        } catch (Exception e) {
            // Tracking non-critique : log WARN (pas debug) pour voir les vrais bugs
            log.warn("[USAGE] Failed to record assistant token usage : {}",
                    e.getMessage(), e);
        }
    }

    private LoopOutcome streamOneTurn(ChatRequest request,
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
                // Tokens FACTURÉS (cache OpenAI décompté à ~50%) → coût réel dans la vue Consommation (#4).
                outcome.promptTokens = done.billedPromptTokens();
                outcome.completionTokens = done.completionTokens();
                outcome.cachedPromptTokens = done.cachedPromptTokens();
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

    private ToolResult executeTool(ChatMessage.ToolCall call, AgentContext context) {
        // RBAC least-privilege : un role operationnel (technicien/menage/supervisor...)
        // ne peut executer QUE les outils d'intervention (scopes a ses interventions au
        // niveau service). Defense-in-depth : meme si le LLM invoque un outil non expose
        // (hallucination), on le bloque ici.
        if (!RoleToolPolicy.isToolAllowed(call.name(), context)) {
            log.warn("Tool '{}' refuse pour le role courant (RBAC operationnel)", call.name());
            recordMetric(call.name(), false);
            return ToolResult.error("Cet outil n'est pas disponible pour votre role.");
        }
        Optional<ToolHandler> handler = toolRegistry.find(call.name());
        if (handler.isEmpty()) {
            log.warn("Tool '{}' inconnu (demande par le LLM)", call.name());
            recordMetric(call.name(), false);
            return ToolResult.error("Tool '" + call.name() + "' non disponible");
        }
        boolean isWrite = handler.get().descriptor() != null
                && handler.get().descriptor().requiresConfirmation();
        try {
            JsonNode args = parseArgsSafe(call.arguments());
            ToolResult result = handler.get().execute(args, context);
            boolean success = !result.isError();
            recordMetric(call.name(), success);
            recordAudit(call.name(), call.arguments(), isWrite, success, context);
            return result;
        } catch (ToolExecutionException e) {
            log.info("Tool '{}' a echoue (previsible) : {}", call.name(), e.getMessage());
            recordMetric(call.name(), false);
            recordAudit(call.name(), call.arguments(), isWrite, false, context);
            return ToolResult.error(e.getMessage());
        } catch (Exception e) {
            log.error("Tool '{}' a leve une exception inattendue", call.name(), e);
            recordMetric(call.name(), false);
            recordAudit(call.name(), call.arguments(), isWrite, false, context);
            return ToolResult.error("Erreur interne lors de l'execution de " + call.name());
        }
    }

    /** Compteur Micrometer d'execution d'outil (null-safe : instrumentation optionnelle). */
    private void recordMetric(String toolName, boolean success) {
        if (toolMetrics != null) {
            toolMetrics.recordExecution(toolName, success);
        }
    }

    /** Audit-logging d'une action d'outil (null-safe : instrumentation optionnelle). */
    private void recordAudit(String toolName, String argsJson, boolean isWrite,
                             boolean success, AgentContext context) {
        if (actionAuditService != null) {
            actionAuditService.recordToolExecution(toolName, argsJson, isWrite, success, context);
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

    private String serializeToolCallsSafe(List<ChatMessage.ToolCall> calls) {
        if (calls == null || calls.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(calls);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize tool_calls : {}", e.getMessage());
            return null;
        }
    }

    // ─── State holder for one LLM turn ─────────────────────────────────────

    private static final class LoopOutcome {
        String text;
        List<ChatMessage.ToolCall> toolCalls;
        int promptTokens;
        int completionTokens;
        int cachedPromptTokens;
        String model;
        String finishReason;
        String error;
    }
}
