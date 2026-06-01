package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
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
            // Tool sensible (write/destructive) intercepte : on PROPAGE pour que
            // l'orchestrator + AgentOrchestrator fallbackent sur le mono-agent
            // qui gere la pause-confirmation. Ne PAS wrapper en error : le caller
            // doit pouvoir distinguer ce cas (info) d'une vraie erreur LLM/tool.
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
        // Resoudre les ToolDescriptors restreints au sub-set du specialiste
        Set<String> allowedTools = toolNames();
        List<ToolDescriptor> tools = toolRegistry.listDescriptors().stream()
                .filter(td -> allowedTools.contains(td.name()))
                .toList();
        if (tools.size() != allowedTools.size()) {
            log.warn("Specialist '{}' declares {} tools but only {} resolved from registry",
                    name(), allowedTools.size(), tools.size());
        }

        // Boucle LLM ↔ tools (bornee). buildSystemPrompt(request) injecte
        // user_context + memory + RAG depuis SpecialistRequest (Fix bloquant #5).
        ChatRequest chatRequest = new ChatRequest(
                buildSystemPrompt(request),
                List.of(ChatMessage.user(request.query())),
                tools,
                null,             // model defaut provider
                TEMPERATURE,
                MAX_TOKENS
        );
        List<String> toolCallsLog = new ArrayList<>();
        List<ToolInvocationSnapshot> toolInvocations = new ArrayList<>();
        AtomicInteger promptTokens = new AtomicInteger();
        AtomicInteger completionTokens = new AtomicInteger();

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
                    promptTokens.addAndGet(done.promptTokens());
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

            // Append message assistant avec tool_calls + executer tools
            chatRequest = chatRequest.withAppendedMessage(
                    ChatMessage.assistantToolCalls(toolCalls)
            );
            for (ChatMessage.ToolCall tc : toolCalls) {
                ToolResult tr = executeTool(tc, request);
                toolCallsLog.add(tc.name());
                toolInvocations.add(new ToolInvocationSnapshot(
                        tc.name(), tr.content(), tr.displayHint(), tr.isError()
                ));
                chatRequest = chatRequest.withAppendedMessage(
                        ChatMessage.tool(tc.id(), tr.content())
                );
            }
        }

        // Iterations atteintes — partial (avec snapshots quand meme)
        return new SpecialistResult(
                "(reponse partielle apres " + MAX_ITERATIONS + " iterations)",
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
            return ToolResult.error("Tool '" + tc.name() + "' not in specialist scope");
        }
        ToolHandler handler = toolRegistry.find(tc.name()).orElse(null);
        if (handler == null) {
            return ToolResult.error("Unknown tool : " + tc.name());
        }
        // Garde-fou critique : si le tool requiert une confirmation user (write
        // destructif), on NE l'execute PAS — on signale a l'orchestrator via
        // une exception sentinel → fallback mono-agent qui a le flow pause-confirm.
        if (handler.descriptor() != null && handler.descriptor().requiresConfirmation()) {
            log.info("Specialist '{}' tried to invoke '{}' which requires user confirmation — "
                    + "throwing ConfirmationRequiredException to trigger mono-agent fallback",
                    name(), tc.name());
            throw new ConfirmationRequiredException(tc.name());
        }
        try {
            JsonNode args = objectMapper.readTree(tc.arguments());
            return handler.execute(args, request.context());
        } catch (ConfirmationRequiredException e) {
            // Propage (au cas ou une future implementation throw depuis execute)
            throw e;
        } catch (Exception e) {
            log.warn("Tool '{}' execution failed in specialist '{}' : {}",
                    tc.name(), name(), e.getMessage());
            return ToolResult.error(e.getMessage());
        }
    }
}
