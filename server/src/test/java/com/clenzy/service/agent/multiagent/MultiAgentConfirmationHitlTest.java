package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests du HITL natif multi-agent : un specialist qui croise un tool
 * {@code requiresConfirmation} ne fait PLUS un fallback mono-agent — l'orchestrateur
 * met le flow EN PAUSE de maniere resumable.
 *
 * <p>Couvre la machine a etats :</p>
 * <ol>
 *   <li><b>PAUSE</b> : orchestrator delegue → specialist demande un write tool →
 *       {@link MultiAgentConfirmationPauseException} portant un
 *       {@link MultiAgentPendingContext} complet ; le write tool n'est PAS execute.</li>
 *   <li><b>RESUME confirme</b> : {@code resumeOrchestration} injecte le tool result,
 *       le specialist conclut, l'orchestrateur produit la reponse finale.</li>
 *   <li><b>RESUME refuse</b> : tool result "annule par user" injecte, reponse finale
 *       formulee sans avoir execute le write tool.</li>
 * </ol>
 *
 * <p>Le {@link ChatLLMProvider} est mocke ; on distingue les appels orchestrateur
 * (presence du tool {@code delegate_to}) des appels specialist par inspection du
 * {@link ChatRequest}.</p>
 */
class MultiAgentConfirmationHitlTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private ObjectMapper objectMapper;
    private MeterRegistry meterRegistry;
    private SpecialistRegistry specialistRegistry;
    private OrchestratorAgent orchestrator;
    private ToolHandler cancelHandler;

    private static final String CANCEL_TOOL = "cancel_reservation";
    private static final AgentContext CTX = AgentContext.minimal(1L, "kc-user");

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        toolRegistry = mock(ToolRegistry.class);
        objectMapper = new ObjectMapper();
        meterRegistry = new SimpleMeterRegistry();

        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ToolDescriptor cancelDescriptor = ToolDescriptor.write(
                CANCEL_TOOL, "Annule une reservation (destructif)", schema);
        cancelHandler = mock(ToolHandler.class);
        when(cancelHandler.descriptor()).thenReturn(cancelDescriptor);
        when(toolRegistry.find(CANCEL_TOOL)).thenReturn(Optional.of(cancelHandler));
        when(toolRegistry.listDescriptors()).thenReturn(List.of(cancelDescriptor));

        // Specialist reel (AbstractAgentSpecialist) avec le sub-set {cancel_reservation}.
        OpsSpecialist ops = new OpsSpecialist(chatProvider, toolRegistry, objectMapper, meterRegistry);
        specialistRegistry = mock(SpecialistRegistry.class);
        when(specialistRegistry.find("operations")).thenReturn(Optional.of(ops));
        when(specialistRegistry.all()).thenReturn(java.util.Map.of("operations", ops));
        when(specialistRegistry.size()).thenReturn(1);

        // HITL active (defaut true).
        orchestrator = new OrchestratorAgent(chatProvider, specialistRegistry,
                objectMapper, meterRegistry, true);
    }

    @Test
    void multiAgent_pauses_with_resume_context_and_does_not_execute_write_tool() {
        // Orchestrator delegue a "operations" ; le specialist demande cancel_reservation.
        stubProvider(/*specialistEmitsConfirmTool*/ true, /*specialistConcludes*/ false,
                /*orchestratorFinalText*/ null);

        MultiAgentConfirmationPauseException pause = catchPause(() ->
                orchestrator.orchestrate(
                        List.of(ChatMessage.user("annule la reservation 42")), CTX,
                        OrchestrationContext.empty(), null, null));

        // Securite : le write tool n'a PAS ete execute pendant la pause.
        verify(cancelHandler, never()).execute(any(), any());

        // Le contexte de reprise est complet.
        MultiAgentPendingContext pc = pause.pendingContext();
        assertThat(pc.specialistName()).isEqualTo("operations");
        assertThat(pc.pendingToolCall().name()).isEqualTo(CANCEL_TOOL);
        assertThat(pc.pendingToolCall().id()).isEqualTo("spec-tc-1");
        assertThat(pc.delegateToolCallId()).isEqualTo("orch-tc-1");
        // Historique specialist : doit finir par l'assistant tool_calls (le tour de pause).
        ChatMessage lastSpec = pc.specialistHistory().get(pc.specialistHistory().size() - 1);
        assertThat(lastSpec.role()).isEqualTo(ChatMessage.ROLE_ASSISTANT);
        assertThat(lastSpec.toolCalls()).extracting(ChatMessage.ToolCall::name).contains(CANCEL_TOOL);
        // Historique orchestrateur : doit finir par l'assistant delegate_to.
        ChatMessage lastOrch = pc.orchestratorMessages().get(pc.orchestratorMessages().size() - 1);
        assertThat(lastOrch.role()).isEqualTo(ChatMessage.ROLE_ASSISTANT);
        assertThat(lastOrch.toolCalls()).extracting(ChatMessage.ToolCall::name)
                .contains(OrchestratorAgent.DELEGATE_TOOL_NAME);

        // Metric de pause incrementee.
        assertThat(meterRegistry.counter("assistant.orchestrator.confirmation_pause",
                "specialist", "operations", "tool", CANCEL_TOOL).count()).isEqualTo(1.0);
    }

    @Test
    void resume_confirmed_executes_synthesis_path_and_produces_final_text() {
        // 1) PAUSE
        stubProvider(true, false, null);
        MultiAgentPendingContext pc = catchPause(() ->
                orchestrator.orchestrate(List.of(ChatMessage.user("annule 42")), CTX,
                        OrchestrationContext.empty(), null, null)).pendingContext();

        // 2) RESUME : le specialist conclut, l'orchestrateur produit le texte final.
        stubProvider(false, true, "C'est fait, la reservation 42 est annulee.");

        ToolResult confirmed = ToolResult.success("{\"cancelled\":true}", "summary");
        StringBuilder streamed = new StringBuilder();
        OrchestratorAgent.OrchestrationResult result = orchestrator.resumeOrchestration(
                pc, CTX, OrchestrationContext.empty(), null, confirmed, streamed::append);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.finalText()).contains("annulee");
        assertThat(streamed.toString()).contains("annulee");
        assertThat(result.delegationsLog()).anyMatch(s -> s.contains("RESUMED"));
        // stubProvider() reinitialise callCount au resume : 2 appels LLM durant la
        // reprise = specialist (conclut avec le tool result injecte) + orchestrateur
        // (produit le texte final). Prouve la re-entree complete dans le multi-agent.
        assertThat(callCount.get()).isEqualTo(2);

        // Le specialist a bien repris avec le tool result CONFIRME injecte en
        // derniere position (apparie a l'id du pending tool call).
        ChatRequest resumeReq = specialistResumeRequest.get();
        assertThat(resumeReq).as("specialist resume request captured").isNotNull();
        ChatMessage injected = resumeReq.messages().get(resumeReq.messages().size() - 1);
        assertThat(injected.role()).isEqualTo(ChatMessage.ROLE_TOOL);
        assertThat(injected.toolCallId()).isEqualTo("spec-tc-1");
        assertThat(injected.content()).contains("cancelled");
    }

    @Test
    void resume_refused_produces_final_text_without_executing_tool() {
        // 1) PAUSE
        stubProvider(true, false, null);
        MultiAgentPendingContext pc = catchPause(() ->
                orchestrator.orchestrate(List.of(ChatMessage.user("annule 42")), CTX,
                        OrchestrationContext.empty(), null, null)).pendingContext();

        // 2) RESUME refuse : tool result "annule par user" injecte.
        stubProvider(false, true, "Ok, je n'ai rien annule.");
        ToolResult refused = ToolResult.error("L'utilisateur a refuse l'execution de cette action.");

        OrchestratorAgent.OrchestrationResult result = orchestrator.resumeOrchestration(
                pc, CTX, OrchestrationContext.empty(), null, refused, s -> {});

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.finalText()).contains("rien annule");
        // Le write tool n'est jamais execute (ni a la pause, ni a la reprise).
        verify(cancelHandler, never()).execute(any(), any());
    }

    // ─── Stub LLM stateful ─────────────────────────────────────────────────

    private final AtomicInteger callCount = new AtomicInteger();
    /** Capture le ChatRequest du specialist qui voyait deja un tool_result (= reprise). */
    private final java.util.concurrent.atomic.AtomicReference<ChatRequest> specialistResumeRequest =
            new java.util.concurrent.atomic.AtomicReference<>();

    /**
     * Configure le provider mock. Discrimine orchestrateur (tool delegate_to present)
     * vs specialist (sub-set metier) par inspection du ChatRequest.
     *
     * @param specialistEmitsConfirmTool le specialist demande cancel_reservation
     * @param specialistConcludes        le specialist repond en texte (fin de boucle)
     * @param orchestratorFinalText      texte final de l'orchestrateur (null = delegue)
     */
    private void stubProvider(boolean specialistEmitsConfirmTool,
                              boolean specialistConcludes,
                              String orchestratorFinalText) {
        callCount.set(0);
        doAnswer(inv -> {
            ChatRequest req = inv.getArgument(0);
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            callCount.incrementAndGet();
            boolean isOrchestrator = req.tools().stream()
                    .anyMatch(t -> OrchestratorAgent.DELEGATE_TOOL_NAME.equals(t.name()));

            if (isOrchestrator) {
                boolean alreadyDelegated = req.messages().stream()
                        .anyMatch(m -> m.toolCalls() != null && m.toolCalls().stream()
                                .anyMatch(tc -> OrchestratorAgent.DELEGATE_TOOL_NAME.equals(tc.name())));
                if (!alreadyDelegated) {
                    // Premier tour orchestrateur : delegue a operations.
                    consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                            new ChatMessage.ToolCall("orch-tc-1", OrchestratorAgent.DELEGATE_TOOL_NAME,
                                    "{\"specialist\":\"operations\",\"query\":\"annule 42\"}"))));
                    consumer.accept(new ChatEvent.Done(10, 5, "claude", "tool_use", ""));
                } else {
                    // Tour final orchestrateur : texte.
                    String txt = orchestratorFinalText == null ? "" : orchestratorFinalText;
                    if (!txt.isEmpty()) consumer.accept(new ChatEvent.TextDelta(txt));
                    consumer.accept(new ChatEvent.Done(12, 8, "claude", "end_turn", txt));
                }
            } else {
                // Specialist. A-t-il deja vu un tool_result (= reprise) ?
                boolean hasToolResult = req.messages().stream()
                        .anyMatch(m -> ChatMessage.ROLE_TOOL.equals(m.role()));
                if (hasToolResult) {
                    specialistResumeRequest.set(req);
                }
                if (hasToolResult || specialistConcludes) {
                    // Reprise / conclusion : repond en texte.
                    consumer.accept(new ChatEvent.TextDelta("synthese specialist"));
                    consumer.accept(new ChatEvent.Done(8, 6, "claude", "end_turn", "synthese specialist"));
                } else if (specialistEmitsConfirmTool) {
                    consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                            new ChatMessage.ToolCall("spec-tc-1", CANCEL_TOOL,
                                    "{\"reservation_id\":42}"))));
                    consumer.accept(new ChatEvent.Done(9, 4, "claude", "tool_use", ""));
                } else {
                    consumer.accept(new ChatEvent.TextDelta("rien a faire"));
                    consumer.accept(new ChatEvent.Done(5, 3, "claude", "end_turn", "rien a faire"));
                }
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }

    private MultiAgentConfirmationPauseException catchPause(Runnable r) {
        MultiAgentConfirmationPauseException ex = catchThrowableOfType(
                r::run, MultiAgentConfirmationPauseException.class);
        assertThat(ex).as("expected a multi-agent confirmation pause").isNotNull();
        return ex;
    }

    /** Specialist de test minimal couvrant le sub-set {cancel_reservation}. */
    private static final class OpsSpecialist extends AbstractAgentSpecialist {
        OpsSpecialist(ChatLLMProvider p, ToolRegistry tr, ObjectMapper om, MeterRegistry mr) {
            super(p, tr, om, mr);
        }
        @Override public String name() { return "operations"; }
        @Override public String domain() { return "Operations terrain"; }
        @Override public String description() { return "Gere les operations (annulations, interventions)"; }
        @Override public Set<String> toolNames() { return Set.of(CANCEL_TOOL); }
    }
}
