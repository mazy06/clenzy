package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.ToolResult;
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
     * System prompt specifique au specialiste. Implementation par defaut OK
     * pour la plupart des cas — peut etre surchargee si besoin de prompt custom.
     */
    protected String buildSystemPrompt() {
        return """
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
                """.formatted(name(), domain(), domain());
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

        // Boucle LLM ↔ tools (bornee)
        ChatRequest chatRequest = new ChatRequest(
                buildSystemPrompt(),
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
