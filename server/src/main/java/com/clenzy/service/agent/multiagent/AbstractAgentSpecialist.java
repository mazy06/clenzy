package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentActionAuditService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentToolMetrics;
import com.clenzy.service.agent.ContextBudget;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Base reutilisable pour {@link AgentSpecialist} : encapsule la boucle
 * LLM → tools → reponse synthese.
 *
 * <p><b>Template Method pattern</b> : les implementations concretes ne
 * surchargent que {@link #name()}, {@link #domain()}, {@link #description()},
 * {@link #toolNames()}, et {@link #buildSystemPrompt()}. La boucle technique
 * est mutualisee ici (DRY).</p>
 *
 * <p>Constantes :</p>
 * <ul>
 *   <li>{@code MAX_ITERATIONS = 4} : safety net (un specialiste n'a pas besoin
 *       de la meme profondeur que l'orchestrator)</li>
 *   <li>{@code MAX_TOKENS = 2048} : reponse + tool args, raisonnablement borne</li>
 *   <li>{@code TEMPERATURE = 0.2} : deterministe (les specialistes font des
 *       analyses factuelles, pas de creativite requise)</li>
 * </ul>
 */
public abstract class AbstractAgentSpecialist implements AgentSpecialist {

    private static final Logger log = LoggerFactory.getLogger(AbstractAgentSpecialist.class);

    protected static final int MAX_ITERATIONS = 4;
    protected static final int MAX_TOKENS = 2048;
    protected static final double TEMPERATURE = 0.2;

    protected final ChatLLMProvider chatProvider;
    protected final ToolRegistry toolRegistry;
    protected final ObjectMapper objectMapper;
    protected final MeterRegistry meterRegistry;
    private final Timer handleTimer;

    // Instrumentation audit + observabilite des executions d'outils. Injectee par
    // setter (optionnelle) pour ne PAS imposer un changement de signature aux 8
    // constructeurs de specialistes ; null-safe en test (construction hors Spring).
    private AgentActionAuditService actionAuditService;
    private AgentToolMetrics toolMetrics;

    @Autowired(required = false)
    public void setActionAuditService(AgentActionAuditService actionAuditService) {
        this.actionAuditService = actionAuditService;
    }

    @Autowired(required = false)
    public void setToolMetrics(AgentToolMetrics toolMetrics) {
        this.toolMetrics = toolMetrics;
    }

    // Tiering de modele par role (T-03). Injecte par setter (optionnel) pour la
    // meme raison que l'instrumentation ci-dessus ; null-safe en test.
    private com.clenzy.service.agent.TierModelResolver tierModelResolver;

    @Autowired(required = false)
    public void setTierModelResolver(com.clenzy.service.agent.TierModelResolver tierModelResolver) {
        this.tierModelResolver = tierModelResolver;
    }

    // Regles de Confiance (X2). Setter optionnel ; null-safe en test.
    private com.clenzy.service.agent.AgentTrustRuleService trustRuleService;

    @Autowired(required = false)
    public void setTrustRuleService(com.clenzy.service.agent.AgentTrustRuleService trustRuleService) {
        this.trustRuleService = trustRuleService;
    }

    /**
     * Modele effectif du specialiste : le tier declare par {@link #tier()} si un
     * mapping est configure pour le provider courant, sinon le modele du contexte
     * (comportement historique — fallback strict).
     */
    private String resolveModelForTier(SpecialistRequest request) {
        String contextModel = request.context().modelOverride();
        if (tierModelResolver == null) {
            return contextModel;
        }
        return tierModelResolver.resolveModel(tier(), request.context().aiProvider(), contextModel);
    }

    protected AbstractAgentSpecialist(ChatLLMProvider chatProvider,
                                        ToolRegistry toolRegistry,
                                        ObjectMapper objectMapper,
                                        MeterRegistry meterRegistry) {
        this.chatProvider = chatProvider;
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.handleTimer = Timer.builder("assistant.specialist.handle")
                .tag("specialist", name())
                .description("Latence de handle() pour un specialiste")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry);
    }

    /**
     * Backwards-compat : delegue a la version request-aware avec request=null.
     * Tests existants peuvent encore appeler buildSystemPrompt() sans arg.
     */
    protected String buildSystemPrompt() {
        return buildSystemPrompt(null);
    }

    /**
     * System prompt specifique au specialiste, enrichi du contexte user
     * (langue + page UI + propriete selectionnee + memoire + RAG) issu de
     * la {@link SpecialistRequest}.
     *
     * <p>Sections injectees en prefix (avant {@code <role>}) :</p>
     * <ul>
     *   <li>{@code <user_context>} : langue + currentPage + selectedPropertyId</li>
     *   <li>{@code <memory>} : memoires long-terme du user</li>
     *   <li>{@code <knowledge_base>} : snippets RAG relevants</li>
     * </ul>
     *
     * <p>Si {@code request} est null (test direct ou ancien code), seule la
     * partie statique (role/task/output) est rendue.</p>
     *
     * <p>Peut etre surchargee par un specialist si besoin de prompt custom.
     * Les overrides doivent prendre soin de continuer a injecter le contexte
     * (appel super OU re-implementation).</p>
     */
    protected String buildSystemPrompt(SpecialistRequest request) {
        StringBuilder sb = new StringBuilder(1024);

        if (request != null) {
            String ctxSection = renderUserContextSection(request.context());
            if (!ctxSection.isEmpty()) sb.append(ctxSection).append("\n\n");

            String memorySection = renderMemorySection(request.orchestrationCtx().memories());
            if (!memorySection.isEmpty()) sb.append(memorySection).append("\n\n");

            String kbSection = renderKbSection(request.orchestrationCtx().kbHits());
            if (!kbSection.isEmpty()) sb.append(kbSection).append("\n\n");
        }

        sb.append("""
                <role>
                Tu es le specialiste %s pour Clenzy PMS. Ton domaine : %s.
                </role>

                <task>
                Reponds a la query qui t'est deleguee de maniere FACTUELLE et CONCISE.
                - Utilise les tools a ta disposition pour rassembler les donnees
                - Synthese en 2-4 phrases maximum (pas de markdown decoratif)
                - Si une donnee manque, dis-le explicitement
                - Si tu ne peux pas traiter la query (hors-scope), reponds
                  "Cette demande sort de mon domaine (%s)."
                </task>

                <output>
                Reponds DIRECTEMENT le texte synthese (pas de prefix, pas de format
                special). Ton orchestrator combinera ta reponse avec d'autres pour
                produire la reponse user finale.
                </output>
                """.formatted(name(), domain(), domain()));

        // Garde anti-injection : les specialistes executent des tools dont les
        // resultats (messages/notes de guests, avis...) peuvent contenir des
        // pseudo-instructions. Rappeler de les traiter comme de la donnee.
        sb.append('\n').append(PromptSecurityGuidance.block());

        return sb.toString();
    }

    /**
     * Render XML du contexte UI (langue + page + propriete). Vide si ctx null
     * ou pas d'info contextuelle au-dela de la langue par defaut "fr".
     */
    private String renderUserContextSection(com.clenzy.service.agent.AgentContext ctx) {
        if (ctx == null) return "";
        boolean hasUiHint = ctx.currentPage() != null || ctx.selectedPropertyId() != null;
        boolean hasNonDefaultLang = ctx.language() != null && !"fr".equals(ctx.language());
        if (!hasUiHint && !hasNonDefaultLang) return "";

        StringBuilder sb = new StringBuilder(192);
        sb.append("<user_context>\n");
        if (ctx.language() != null && !ctx.language().isBlank()) {
            sb.append("  <language>").append(escapeXml(ctx.language())).append("</language>\n");
            sb.append("  <!-- Reponds en ");
            switch (ctx.language()) {
                case "en" -> sb.append("English");
                case "ar" -> sb.append("Arabic (RTL)");
                case "fr" -> sb.append("francais");
                default -> sb.append("la langue indiquee");
            }
            sb.append(". -->\n");
        }
        if (ctx.currentPage() != null && !ctx.currentPage().isBlank()) {
            sb.append("  <current_page>").append(escapeXml(ctx.currentPage())).append("</current_page>\n");
        }
        if (ctx.selectedPropertyId() != null) {
            sb.append("  <selected_property_id>").append(ctx.selectedPropertyId())
                    .append("</selected_property_id>\n");
        }
        sb.append("</user_context>");
        return sb.toString();
    }

    /** Render XML de la memoire user (vide si rien). */
    private String renderMemorySection(java.util.List<com.clenzy.model.AssistantMemory> memories) {
        if (memories == null || memories.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(256);
        sb.append("<memory>\n");
        for (com.clenzy.model.AssistantMemory m : memories) {
            com.clenzy.model.AssistantMemory.Scope scope = m.getScopeEnum();
            sb.append("  <item scope=\"")
                    .append(scope == null ? "unknown" : scope.name().toLowerCase())
                    .append("\" key=\"").append(escapeXml(m.getMemoryKey())).append("\">")
                    .append(escapeXml(m.getMemoryValue()))
                    .append("</item>\n");
        }
        sb.append("</memory>");
        return sb.toString();
    }

    /** Render XML des snippets RAG (vide si rien). */
    private String renderKbSection(
            java.util.List<com.clenzy.service.agent.kb.KbSearchService.KbSearchHit> kbHits) {
        if (kbHits == null || kbHits.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(512);
        sb.append("<knowledge_base>\n")
                .append("  <!-- Snippets de la doc Clenzy lies a la query. Cite la source ")
                .append("(titre + path) si tu utilises l'info. N'invente jamais. -->\n");
        for (int i = 0; i < kbHits.size(); i++) {
            com.clenzy.service.agent.kb.KbSearchService.KbSearchHit h = kbHits.get(i);
            sb.append("  <snippet idx=\"").append(i + 1).append("\" ")
                    .append("title=\"").append(escapeXml(h.title() != null ? h.title() : "Document")).append("\" ")
                    .append("path=\"").append(escapeXml(h.sourcePath())).append("\" ")
                    .append("relevance=\"").append(Math.round(h.relevance() * 100)).append("%\">\n")
                    .append("    ").append(escapeXml(h.snippet())).append("\n")
                    .append("  </snippet>\n");
        }
        sb.append("</knowledge_base>");
        return sb.toString();
    }

    /** Delegate au StringUtils partage pour eviter la divergence avec OrchestratorAgent. */
    private static String escapeXml(String s) {
        return com.clenzy.util.StringUtils.escapeXml(s);
    }

    @Override
    public final SpecialistResult handle(SpecialistRequest request) {
        long startNanos = System.nanoTime();
        try {
            return doHandle(request);
        } catch (ConfirmationRequiredException e) {
            // Tool sensible (write/destructif) intercepte. Deux issues selon le
            // mode (cf. ConfirmationRequiredException) :
            //   - resume context present → HITL natif multi-agent : l'orchestrator
            //     persiste le contexte et expose la confirmation, PAS de fallback.
            //   - sinon → fallback mono-agent legacy.
            // Dans les deux cas on PROPAGE (info, pas error) pour que le caller
            // distingue ce cas d'une vraie erreur LLM/tool.
            meterRegistry.counter("assistant.specialist.confirmation_required",
                    "specialist", name(), "tool", e.toolName()).increment();
            throw e;
        } catch (Exception e) {
            log.warn("Specialist '{}' threw : {}", name(), e.getMessage(), e);
            meterRegistry.counter("assistant.specialist.errors", "specialist", name()).increment();
            return SpecialistResult.error(e.getMessage());
        } finally {
            handleTimer.record(System.nanoTime() - startNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    private SpecialistResult doHandle(SpecialistRequest request) {
        // Boucle LLM ↔ tools (bornee). buildSystemPrompt(request) injecte
        // user_context + memory + RAG depuis SpecialistRequest (Fix bloquant #5).
        ChatRequest chatRequest = new ChatRequest(
                buildSystemPrompt(request),
                List.of(ChatMessage.user(request.query())),
                resolveTools(),
                resolveModelForTier(request),        // tier du role (T-03) ou modele resolu (Settings/BYOK)
                TEMPERATURE,
                MAX_TOKENS,
                null,                                 // system mono-bloc (pas de suffixe volatil)
                request.context().aiProvider(),       // provider effectif (routage multi-provider)
                request.context().aiBaseUrl()
        );
        return runLoop(chatRequest, request, new ArrayList<>(), new ArrayList<>());
    }

    /**
     * Reprise d'une boucle specialist suspendue sur une confirmation user (HITL
     * natif multi-agent).
     *
     * <p>Reconstruit le {@link ChatRequest} a partir de {@code specialistHistory}
     * (l'historique jusqu'au tour de pause inclus, dernier element = assistant
     * tool_calls) + le {@code toolResult} du tool confirme/refuse, puis relance
     * la boucle normale. Le tool sensible a DEJA ete execute (ou refuse) par le
     * caller — on injecte juste son resultat ; il n'est PAS re-execute ici.</p>
     *
     * <p><b>Securite</b> : un eventuel SECOND tool de confirmation rencontre
     * pendant la reprise re-leve {@link ConfirmationRequiredException} (chainage
     * de confirmations supporte par le caller).</p>
     *
     * @param request    SpecialistRequest reconstruit au resume (identite + cible LLM)
     * @param history    historique du specialist jusqu'au tour de pause inclus
     * @param toolCallId id du tool call confirme (pour appairer le tool result)
     * @param toolResult resultat du tool (execution reelle OU "annule par user")
     */
    public final SpecialistResult resumeWithToolResult(SpecialistRequest request,
                                                       List<ChatMessage> history,
                                                       String toolCallId,
                                                       ToolResult toolResult) {
        long startNanos = System.nanoTime();
        try {
            // Reconstruire la requete : system prompt courant + historique capture
            // + le tool result du tool confirme/refuse en derniere position.
            List<ChatMessage> resumed = new ArrayList<>(history);
            resumed.add(ChatMessage.tool(toolCallId, toolResult.content()));

            ChatRequest chatRequest = new ChatRequest(
                    buildSystemPrompt(request),
                    resumed,
                    resolveTools(),
                    resolveModelForTier(request),    // meme tier qu'au run initial (T-03)
                    TEMPERATURE,
                    MAX_TOKENS,
                    null,
                    request.context().aiProvider(),
                    request.context().aiBaseUrl()
            );

            // Pas de seed de snapshot pour le tool confirme : l'AgentOrchestrator
            // emet deja son event tool_call_executed (parite avec le flux mono).
            // On part de logs/snapshots vides ; runLoop accumulera les eventuels
            // tools read-only que le specialist invoque encore apres reprise.
            return runLoop(chatRequest, request, new ArrayList<>(), new ArrayList<>());
        } catch (ConfirmationRequiredException e) {
            meterRegistry.counter("assistant.specialist.confirmation_required",
                    "specialist", name(), "tool", e.toolName()).increment();
            throw e;
        } catch (Exception e) {
            log.warn("Specialist '{}' resume threw : {}", name(), e.getMessage(), e);
            meterRegistry.counter("assistant.specialist.errors", "specialist", name()).increment();
            return SpecialistResult.error(e.getMessage());
        } finally {
            handleTimer.record(System.nanoTime() - startNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    /** Resout les ToolDescriptors restreints au sub-set du specialiste. */
    private List<ToolDescriptor> resolveTools() {
        Set<String> allowedTools = toolNames();
        List<ToolDescriptor> tools = toolRegistry.listDescriptors().stream()
                .filter(td -> allowedTools.contains(td.name()))
                .toList();
        if (tools.size() != allowedTools.size()) {
            log.warn("Specialist '{}' declares {} tools but only {} resolved from registry",
                    name(), allowedTools.size(), tools.size());
        }
        return tools;
    }

    /**
     * Boucle LLM ↔ tools bornee, partagee entre {@link #doHandle} (depart a froid)
     * et {@link #resumeWithToolResult} (reprise apres confirmation).
     *
     * <p>Quand un tool {@code requiresConfirmation} est rencontre, leve
     * {@link ConfirmationRequiredException} <b>enrichie</b> : elle porte
     * l'historique conversationnel ACCUMULE jusqu'au tour de pause inclus (le
     * dernier message etant l'assistant tool_calls), permettant la reprise
     * EN MULTI-AGENT.</p>
     */
    private SpecialistResult runLoop(ChatRequest chatRequest,
                                     SpecialistRequest request,
                                     List<String> toolCallsLog,
                                     List<ToolInvocationSnapshot> toolInvocations) {
        AtomicInteger promptTokens = new AtomicInteger();
        AtomicInteger completionTokens = new AtomicInteger();
        // Cache anti-boucle : signature (nom+args) -> resultat. Un modele peut
        // re-demander un tool deja execute ; on reutilise le resultat (le protocole
        // exige un tool_result par tool_call_id) SANS re-executer ni re-emettre le widget.
        java.util.Map<String, ToolResult> executedTools = new java.util.HashMap<>();
        // Dernier texte non-vide vu (pour un repli exploitable si la boucle est
        // bornee sans reponse finale plutot qu'un marqueur technique brut).
        String lastNonEmptyText = "";

        for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
            AtomicReference<String> textOut = new AtomicReference<>("");
            AtomicReference<List<ChatMessage.ToolCall>> toolCallsRef = new AtomicReference<>(List.of());
            AtomicReference<String> errorMsg = new AtomicReference<>();

            // Fix bloquant #4 : utiliser la cle BYOK de l'org si fournie, sinon
            // la cle plateforme (mecanisme natif chatProvider).
            java.util.function.Consumer<ChatEvent> eventConsumer = event -> {
                if (event instanceof ChatEvent.TextDelta td) {
                    textOut.set(textOut.get() + td.delta());
                } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                    toolCallsRef.set(tcr.calls());
                } else if (event instanceof ChatEvent.Done done) {
                    // Tokens FACTURÉS (cache OpenAI décompté) → coût réel agrégé côté orchestrateur (#4).
                    promptTokens.addAndGet(done.billedPromptTokens());
                    completionTokens.addAndGet(done.completionTokens());
                } else if (event instanceof ChatEvent.Error err) {
                    errorMsg.set(err.message());
                }
            };
            if (request.apiKey() != null) {
                chatProvider.streamChat(chatRequest, eventConsumer, request.apiKey());
            } else {
                chatProvider.streamChat(chatRequest, eventConsumer);
            }

            if (errorMsg.get() != null) {
                return SpecialistResult.error(errorMsg.get());
            }

            if (!textOut.get().isBlank()) {
                lastNonEmptyText = textOut.get().strip();
            }

            List<ChatMessage.ToolCall> toolCalls = toolCallsRef.get();
            if (toolCalls.isEmpty()) {
                // Texte final = synthese a remonter (avec snapshots des widgets)
                return SpecialistResult.success(
                        textOut.get().strip(),
                        toolCallsLog,
                        toolInvocations,
                        promptTokens.get(),
                        completionTokens.get()
                );
            }

            // Append message assistant avec tool_calls AVANT l'execution : si un
            // des tools requiert confirmation, l'historique a capturer doit inclure
            // ce tour assistant (les tool_results suivront a la reprise).
            ChatRequest withAssistantTurn = chatRequest.withAppendedMessage(
                    ChatMessage.assistantToolCalls(toolCalls)
            );

            // Garde-fou critique : detecter un tool a confirmation AVANT toute
            // execution. On suspend la boucle complete (pas d'execution partielle).
            // X2 : une Regle de Confiance ACTIVE (acceptee par un humain) fait
            // passer l'outil en « notifier » — pas de pause, execution tracee.
            for (ChatMessage.ToolCall tc : toolCalls) {
                ToolHandler handler = toolRegistry.find(tc.name()).orElse(null);
                if (handler != null && handler.descriptor() != null
                        && handler.descriptor().requiresConfirmation()
                        && (trustRuleService == null || !trustRuleService.isAutoApproved(
                                request.context().organizationId(), tc.name()))) {
                    log.info("Specialist '{}' pausing on '{}' (requires user confirmation) — "
                            + "signaling resumable multi-agent pause", name(), tc.name());
                    // Historique a capturer = tout jusqu'au tour assistant inclus.
                    // Le caller (orchestrator) y appendra le tool_result au resume.
                    throw new ConfirmationRequiredException(tc, withAssistantTurn.messages());
                }
            }

            chatRequest = withAssistantTurn;
            boolean anyNewTool = false;
            for (ChatMessage.ToolCall tc : toolCalls) {
                String sig = tc.name() + "::" + (tc.arguments() == null ? "" : tc.arguments());
                ToolResult tr = executedTools.get(sig);
                if (tr == null) {
                    tr = executeTool(tc, request);
                    executedTools.put(sig, tr);
                    toolCallsLog.add(tc.name());
                    toolInvocations.add(new ToolInvocationSnapshot(
                            tc.name(), tr.content(), tr.displayHint(), tr.isError()
                    ));
                    anyNewTool = true;
                }
                // Copie ENVOYÉE au LLM tronquée si volumineuse (lever #2) ; le snapshot
                // widget ci-dessus (toolInvocations) garde le contenu complet.
                chatRequest = chatRequest.withAppendedMessage(
                        ChatMessage.tool(tc.id(), ContextBudget.capToolResult(tr.content()))
                );
            }
            if (!anyNewTool) {
                // Le modele ne re-demande que des tools deja executes -> boucle sterile.
                // On arrete et on remonte ce qu'on a (widgets + texte courant) ;
                // l'orchestrateur produira la reponse finale.
                log.info("Specialist '{}' breaking sterile tool loop (only duplicate calls)", name());
                return SpecialistResult.success(
                        textOut.get().strip(), toolCallsLog, toolInvocations,
                        promptTokens.get(), completionTokens.get());
            }
        }

        // Iterations atteintes — partial. La synthese alimente l'orchestrateur
        // (qui la reformule) ; on fournit un texte exploitable comme repli plutot
        // qu'un marqueur technique brut (au cas ou il remonterait tel quel a l'user) :
        // le dernier texte vu, sinon une formulation honnete.
        String partial = !lastNonEmptyText.isBlank()
                ? lastNonEmptyText
                : "Je n'ai pas pu finaliser l'analyse de cette demande.";
        return new SpecialistResult(
                partial,
                toolCallsLog,
                toolInvocations,
                promptTokens.get(),
                completionTokens.get(),
                true,
                null
        );
    }

    private ToolResult executeTool(ChatMessage.ToolCall tc, SpecialistRequest request) {
        // Defense en profondeur : verifier que le tool est bien dans le sub-set autorise
        if (!toolNames().contains(tc.name())) {
            log.warn("Specialist '{}' tried to invoke unauthorized tool '{}'", name(), tc.name());
            recordMetric(tc.name(), false);
            return ToolResult.error("Tool '" + tc.name() + "' not in specialist scope");
        }
        ToolHandler handler = toolRegistry.find(tc.name()).orElse(null);
        if (handler == null) {
            recordMetric(tc.name(), false);
            return ToolResult.error("Unknown tool : " + tc.name());
        }
        // Garde-fou critique (defense en profondeur) : un tool requiresConfirmation
        // ne doit JAMAIS atteindre execute() ici — runLoop l'intercepte AVANT. Si
        // on y arrive, c'est un bug : on re-leve (mode fallback legacy, sans contexte).
        if (handler.descriptor() != null && handler.descriptor().requiresConfirmation()) {
            log.warn("Specialist '{}' reached executeTool for confirmation tool '{}' — "
                    + "should have been intercepted by runLoop", name(), tc.name());
            throw new ConfirmationRequiredException(tc.name());
        }
        boolean isWrite = handler.descriptor() != null && handler.descriptor().requiresConfirmation();
        try {
            JsonNode args = objectMapper.readTree(tc.arguments());
            ToolResult result = handler.execute(args, request.context());
            boolean success = !result.isError();
            recordMetric(tc.name(), success);
            recordAudit(tc.name(), tc.arguments(), isWrite, success, request.context());
            return result;
        } catch (ConfirmationRequiredException e) {
            // Propage (au cas ou une future implementation throw depuis execute)
            throw e;
        } catch (Exception e) {
            log.warn("Tool '{}' execution failed in specialist '{}' : {}",
                    tc.name(), name(), e.getMessage());
            recordMetric(tc.name(), false);
            recordAudit(tc.name(), tc.arguments(), isWrite, false, request.context());
            return ToolResult.error(e.getMessage());
        }
    }

    /** Compteur Micrometer d'execution d'outil (null-safe hors contexte Spring). */
    private void recordMetric(String toolName, boolean success) {
        if (toolMetrics != null) {
            toolMetrics.recordExecution(toolName, success);
        }
    }

    /** Audit-logging d'une action d'outil (null-safe hors contexte Spring). */
    private void recordAudit(String toolName, String argsJson, boolean isWrite,
                             boolean success, AgentContext context) {
        if (actionAuditService != null) {
            actionAuditService.recordToolExecution(toolName, argsJson, isWrite, success, context);
        }
    }
}
