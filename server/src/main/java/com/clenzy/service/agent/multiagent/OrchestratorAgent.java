package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Orchestrateur principal du multi-agent system : decide quel(s)
 * {@link AgentSpecialist} appeler via un meta-tool unique {@code delegate_to}.
 *
 * <p><b>Flow</b> :</p>
 * <ol>
 *   <li>LLM call #1 (orchestrator) : prompt = liste des spécialistes, tool = delegate_to</li>
 *   <li>Le LLM choisit un spécialiste + une query</li>
 *   <li>L'orchestrateur invoque {@link AgentSpecialist#handle} (qui fait LLM call #2)</li>
 *   <li>Le résultat est reinjecte comme tool_result a l'orchestrator</li>
 *   <li>Boucle jusqu'a ce que l'orchestrator produise une reponse texte finale
 *       (ou max iterations atteintes)</li>
 * </ol>
 *
 * <p><b>Pourquoi 1 seul meta-tool</b> : la litterature LLM dit que la qualite
 * de routing dégrade au-dela de ~10 tools. Avec UN seul tool (delegate_to),
 * l'orchestrateur a un choix trivial : "qui est le bon spécialiste pour cette
 * query ?". Pas de distraction par les arguments concrets des tools metier.</p>
 */
@Component
public class OrchestratorAgent {

    private static final Logger log = LoggerFactory.getLogger(OrchestratorAgent.class);

    /** Plafond de delegations par message user (anti-boucle infinie). */
    public static final int MAX_DELEGATIONS = 3;
    public static final int MAX_TOKENS = 1024;
    public static final double TEMPERATURE = 0.1;  // tres deterministe pour le routing

    public static final String DELEGATE_TOOL_NAME = "delegate_to";

    private final ChatLLMProvider chatProvider;
    private final SpecialistRegistry registry;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final Timer orchestrateTimer;

    public OrchestratorAgent(ChatLLMProvider chatProvider,
                               SpecialistRegistry registry,
                               ObjectMapper objectMapper,
                               MeterRegistry meterRegistry) {
        this.chatProvider = chatProvider;
        this.registry = registry;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.orchestrateTimer = Timer.builder("assistant.orchestrator.handle")
                .description("Latence d'une orchestration complete (orchestrator + N specialists)")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry);
    }

    /**
     * Lance l'orchestration synchrone et retourne le texte final.
     *
     * <p>Version non-streaming (PoC). Le streaming SSE bidirectionnel
     * (orchestrator emet tools + specialists emettent au fur et a mesure)
     * sera ajoute en v2 quand l'integration AgentOrchestrator sera faite.</p>
     */
    public OrchestrationResult orchestrate(String userMessage, AgentContext context) {
        long startNanos = System.nanoTime();
        try {
            return doOrchestrate(userMessage, context);
        } finally {
            orchestrateTimer.record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
        }
    }

    private OrchestrationResult doOrchestrate(String userMessage, AgentContext context) {
        // Pas de specialistes -> impossible d'orchestrer
        if (registry.size() == 0) {
            return OrchestrationResult.error("Aucun specialiste enregistre, orchestration impossible");
        }

        String systemPrompt = buildOrchestratorSystemPrompt();
        List<ToolDescriptor> tools = List.of(buildDelegateToolDescriptor());
        ChatRequest req = new ChatRequest(
                systemPrompt,
                List.of(ChatMessage.user(userMessage)),
                tools,
                null,
                TEMPERATURE,
                MAX_TOKENS
        );

        List<String> delegationsLog = new ArrayList<>();
        AtomicInteger totalPromptTokens = new AtomicInteger();
        AtomicInteger totalCompletionTokens = new AtomicInteger();
        StringBuilder finalText = new StringBuilder();

        for (int iter = 0; iter < MAX_DELEGATIONS; iter++) {
            AtomicReference<String> textOut = new AtomicReference<>("");
            AtomicReference<List<ChatMessage.ToolCall>> toolCallsRef = new AtomicReference<>(List.of());
            AtomicReference<String> errorMsg = new AtomicReference<>();

            chatProvider.streamChat(req, event -> {
                if (event instanceof ChatEvent.TextDelta td) {
                    textOut.set(textOut.get() + td.delta());
                } else if (event instanceof ChatEvent.ToolCallRequest tcr) {
                    toolCallsRef.set(tcr.calls());
                } else if (event instanceof ChatEvent.Done done) {
                    totalPromptTokens.addAndGet(done.promptTokens());
                    totalCompletionTokens.addAndGet(done.completionTokens());
                } else if (event instanceof ChatEvent.Error err) {
                    errorMsg.set(err.message());
                }
            });

            if (errorMsg.get() != null) {
                return OrchestrationResult.error("Orchestrator LLM error : " + errorMsg.get());
            }

            List<ChatMessage.ToolCall> toolCalls = toolCallsRef.get();
            if (toolCalls.isEmpty()) {
                // Pas de delegation : l'orchestrator a tranche directement
                finalText.append(textOut.get());
                return OrchestrationResult.success(
                        finalText.toString().strip(),
                        delegationsLog,
                        totalPromptTokens.get(),
                        totalCompletionTokens.get(),
                        iter
                );
            }

            // Append message assistant + executer chaque delegation
            req = req.withAppendedMessage(ChatMessage.assistantToolCalls(toolCalls));
            for (ChatMessage.ToolCall tc : toolCalls) {
                if (!DELEGATE_TOOL_NAME.equals(tc.name())) {
                    log.warn("Orchestrator emitted unknown tool '{}'", tc.name());
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Tool inconnu, seul '" + DELEGATE_TOOL_NAME + "' est autorise"));
                    continue;
                }
                DelegateArgs args = parseDelegateArgs(tc.arguments());
                if (args == null) {
                    req = req.withAppendedMessage(ChatMessage.tool(tc.id(),
                            "Arguments invalides pour delegate_to (besoin de specialist + query)"));
                    continue;
                }
                SpecialistResult result = invokeSpecialist(args, context);
                delegationsLog.add(args.specialist() + " → " + (result.isSuccess() ? "OK" : "ERR"));
                totalPromptTokens.addAndGet(result.promptTokens());
                totalCompletionTokens.addAndGet(result.completionTokens());
                req = req.withAppendedMessage(ChatMessage.tool(tc.id(), result.synthesis()));
                meterRegistry.counter("assistant.orchestrator.delegations",
                        "specialist", args.specialist()).increment();
            }
        }

        // Iterations atteintes — retourner ce qu'on a accumule
        return OrchestrationResult.truncated(
                finalText.toString().strip(),
                delegationsLog,
                totalPromptTokens.get(),
                totalCompletionTokens.get()
        );
    }

    private SpecialistResult invokeSpecialist(DelegateArgs args, AgentContext context) {
        return registry.find(args.specialist())
                .map(spec -> spec.handle(SpecialistRequest.of(args.query(), context)))
                .orElseGet(() -> SpecialistResult.error(
                        "Specialiste inconnu : '" + args.specialist() + "'. "
                                + "Specialistes disponibles : " + registry.all().keySet()
                ));
    }

    private DelegateArgs parseDelegateArgs(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            String specialist = node.path("specialist").asText(null);
            String query = node.path("query").asText(null);
            if (specialist == null || specialist.isBlank() || query == null || query.isBlank()) {
                return null;
            }
            return new DelegateArgs(specialist, query);
        } catch (Exception e) {
            log.warn("Failed to parse delegate_to args : {}", e.getMessage());
            return null;
        }
    }

    /** System prompt orchestrator : liste les specialistes + role + format. */
    String buildOrchestratorSystemPrompt() {
        StringBuilder sb = new StringBuilder(1024);
        sb.append("<role>\n")
                .append("Tu es l'orchestrateur principal de l'assistant Clenzy PMS. ")
                .append("Tu ne reponds JAMAIS directement aux questions metier — tu delegues ")
                .append("a un specialiste via le tool delegate_to.\n")
                .append("</role>\n\n");

        sb.append("<specialists>\n");
        for (Map.Entry<String, AgentSpecialist> entry : registry.all().entrySet()) {
            AgentSpecialist spec = entry.getValue();
            sb.append("- <name>").append(spec.name()).append("</name> : ")
                    .append(spec.description().replace("\n", " ").strip())
                    .append('\n');
        }
        sb.append("</specialists>\n\n");

        sb.append("<workflow>\n")
                .append("1. Lis la question utilisateur.\n")
                .append("2. Choisis LE specialiste le plus pertinent (1 seul a la fois si possible).\n")
                .append("3. Appelle delegate_to(specialist, query) avec une query precise.\n")
                .append("4. Recois la synthese du specialiste.\n")
                .append("5. Si une autre delegation est necessaire, recommence (max ")
                .append(MAX_DELEGATIONS).append(").\n")
                .append("6. Quand tu as toutes les infos, produis la reponse user finale ")
                .append("(2-4 phrases, conversationnel professionnel).\n")
                .append("</workflow>\n\n");

        sb.append("<output_format>\n")
                .append("- Reponse finale : courte (2-4 phrases), francais conversationnel.\n")
                .append("- Pas de meta-commentaires (\"j'ai delegue a...\", \"le specialiste m'a dit...\")\n")
                .append("- Cite la source si l'info vient de la doc (Selon [titre](path)).\n")
                .append("</output_format>");

        return sb.toString();
    }

    /** Schema JSON du meta-tool delegate_to. */
    private ToolDescriptor buildDelegateToolDescriptor() {
        try {
            ObjectNode schema = objectMapper.createObjectNode();
            schema.put("type", "object");
            ObjectNode properties = schema.putObject("properties");

            ObjectNode specialistProp = properties.putObject("specialist");
            specialistProp.put("type", "string");
            specialistProp.put("description",
                    "Nom du specialiste a invoquer (voir <specialists> dans le system prompt)");
            // enum dynamique avec les noms enregistres
            specialistProp.putArray("enum")
                    .addAll(registry.all().keySet().stream()
                            .map(objectMapper.getNodeFactory()::textNode)
                            .toList());

            ObjectNode queryProp = properties.putObject("query");
            queryProp.put("type", "string");
            queryProp.put("description",
                    "Query precise a deleguer au specialiste (langage naturel)");

            schema.putArray("required").add("specialist").add("query");
            schema.put("additionalProperties", false);

            return ToolDescriptor.readOnly(
                    DELEGATE_TOOL_NAME,
                    "Delegue la query a un specialiste expert d'un domaine. UTILISE ABSOLUMENT pour repondre aux questions metier.",
                    schema
            );
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build delegate_to descriptor", e);
        }
    }

    /** Args parses du tool delegate_to. */
    private record DelegateArgs(String specialist, String query) {}

    /** Resultat de orchestrate(). */
    public record OrchestrationResult(
            String finalText,
            List<String> delegationsLog,
            int totalPromptTokens,
            int totalCompletionTokens,
            boolean truncated,
            String error
    ) {
        public static OrchestrationResult success(String text, List<String> log,
                                                    int prompt, int completion, int iterations) {
            return new OrchestrationResult(text, log, prompt, completion, false, null);
        }
        public static OrchestrationResult truncated(String text, List<String> log,
                                                      int prompt, int completion) {
            return new OrchestrationResult(text, log, prompt, completion, true, null);
        }
        public static OrchestrationResult error(String message) {
            return new OrchestrationResult("", List.of(), 0, 0, false, message);
        }
        public boolean isSuccess() {
            return error == null;
        }
    }
}
