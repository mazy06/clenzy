package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentSseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests des events {@code agent_activity} emis par l'orchestrateur multi-agent
 * vers la constellation « Superviseur d'agents » (BLOC 4a).
 *
 * <p>Verifie que l'activitySink recoit le cycle de vie attendu autour d'une
 * delegation (started → thinking → acting(par outil) → done) et que l'absence
 * de sink ne change rien (back-compat).</p>
 */
class OrchestratorAgentActivityTest {

    private ChatLLMProvider chatProvider;
    private AgentSpecialist dataAnalyst;
    private SpecialistRegistry registry;
    private ObjectMapper objectMapper;
    private OrchestratorAgent orchestrator;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        dataAnalyst = mock(AgentSpecialist.class);
        when(dataAnalyst.name()).thenReturn("data_analyst");
        when(dataAnalyst.domain()).thenReturn("Analyse donnees");
        when(dataAnalyst.description()).thenReturn("Pour les questions de KPIs et de chiffres");
        when(dataAnalyst.toolNames()).thenReturn(Set.of("list_properties"));

        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(dataAnalyst));
        registry = new SpecialistRegistry(provider);
        registry.initialize();

        objectMapper = new ObjectMapper();
        orchestrator = new OrchestratorAgent(chatProvider, registry, objectMapper, new SimpleMeterRegistry());
    }

    @Test
    void delegation_emits_started_thinking_acting_done_to_activity_sink() {
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste mes proprietes\"}"
        );

        // Le specialist a invoque 1 outil read-only (list_properties) → 1 event acting.
        when(dataAnalyst.handle(any(SpecialistRequest.class))).thenReturn(
                SpecialistResult.success(
                        "Tu as 5 proprietes",
                        List.of("list_properties"),
                        List.of(new ToolInvocationSnapshot("list_properties", "{\"items\":[]}", "list", false)),
                        30, 15)
        );

        stubTwoTurns(delegate);

        List<AgentSseEvent> activity = new ArrayList<>();
        orchestrator.orchestrate(
                List.of(ChatMessage.user("liste mes proprietes")),
                AgentContext.minimal(1L, "kc"),
                OrchestrationContext.empty(),
                null,
                null,        // textDeltaSink
                activity::add);

        List<AgentSseEvent> agentEvents = activity.stream()
                .filter(e -> "agent_activity".equals(e.type()))
                .toList();

        // Tous concernent data_analyst.
        assertThat(agentEvents).isNotEmpty();
        assertThat(agentEvents).allMatch(e -> "data_analyst".equals(e.toolName()));

        // Phases attendues, dans l'ordre.
        List<String> phases = agentEvents.stream().map(AgentSseEvent::finishReason).toList();
        assertThat(phases).containsExactly("started", "thinking", "acting", "done");

        // L'event acting porte le nom de l'outil reel.
        AgentSseEvent acting = agentEvents.stream()
                .filter(e -> "acting".equals(e.finishReason())).findFirst().orElseThrow();
        assertThat(acting.displayHint()).isEqualTo("list_properties");

        // Le started porte le libelle metier (la query).
        AgentSseEvent started = agentEvents.get(0);
        assertThat(started.toolResult()).isEqualTo("liste mes proprietes");
    }

    @Test
    void erroring_tool_does_not_emit_acting() {
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste\"}"
        );

        when(dataAnalyst.handle(any(SpecialistRequest.class))).thenReturn(
                SpecialistResult.success(
                        "Erreur de chargement",
                        List.of("list_properties"),
                        List.of(new ToolInvocationSnapshot("list_properties", "boom", "list", true)),
                        30, 15)
        );

        stubTwoTurns(delegate);

        List<AgentSseEvent> activity = new ArrayList<>();
        orchestrator.orchestrate(
                List.of(ChatMessage.user("liste")),
                AgentContext.minimal(1L, "kc"),
                OrchestrationContext.empty(),
                null, null, activity::add);

        List<String> phases = activity.stream()
                .filter(e -> "agent_activity".equals(e.type()))
                .map(AgentSseEvent::finishReason).toList();
        // Pas d'event acting pour un outil en erreur.
        assertThat(phases).containsExactly("started", "thinking", "done");
    }

    @Test
    void null_activity_sink_keeps_orchestration_working() {
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste\"}"
        );
        when(dataAnalyst.handle(any(SpecialistRequest.class))).thenReturn(
                SpecialistResult.success("Tu as 5 biens.", List.of("list_properties"), 30, 15)
        );
        stubTwoTurns(delegate);

        // Sans sink : back-compat, aucun crash, orchestration nominale.
        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate(
                List.of(ChatMessage.user("liste")),
                AgentContext.minimal(1L, "kc"),
                OrchestrationContext.empty(),
                null, null, null);

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.delegationsLog()).hasSize(1);
    }

    @Test
    void failing_activity_sink_does_not_break_orchestration() {
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste\"}"
        );
        when(dataAnalyst.handle(any(SpecialistRequest.class))).thenReturn(
                SpecialistResult.success("Tu as 5 biens.", List.of("list_properties"), 30, 15)
        );
        stubTwoTurns(delegate);

        // Un sink qui throw ne doit JAMAIS casser l'orchestration (best-effort).
        Consumer<AgentSseEvent> badSink = e -> { throw new RuntimeException("sink boom"); };

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate(
                List.of(ChatMessage.user("liste")),
                AgentContext.minimal(1L, "kc"),
                OrchestrationContext.empty(),
                null, null, badSink);

        assertThat(r.isSuccess()).isTrue();
    }

    /** Tour 1 : delegate_to ; tour 2 : texte final. */
    private void stubTwoTurns(ChatMessage.ToolCall delegate) {
        AtomicInteger callCount = new AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount.getAndIncrement() == 0) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(delegate)));
                consumer.accept(new ChatEvent.Done(40, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Tu as 5 biens."));
                consumer.accept(new ChatEvent.Done(60, 10, "claude", "end_turn", "Tu as 5 biens."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }
}
