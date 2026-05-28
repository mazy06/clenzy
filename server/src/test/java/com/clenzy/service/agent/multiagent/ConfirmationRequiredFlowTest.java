package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantMemory;
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
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests integration : un specialist qui tente d'invoquer un tool requiresConfirmation
 * DOIT lever {@link ConfirmationRequiredException} sans executer le tool, et
 * cette exception DOIT remonter au caller (orchestrator) pour bascule mono-agent.
 *
 * <p>Justification securite : le multi-agent (v1) ne sait pas faire la pause-confirmation.
 * Si on executait silencieusement les write tools, un user pourrait declencher
 * des actions destructives (cancel_reservation, archive_property) en posant une
 * simple question.</p>
 */
class ConfirmationRequiredFlowTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private ObjectMapper objectMapper;
    private MeterRegistry meterRegistry;
    private TestSpecialist specialist;
    private ToolHandler cancelReservationHandler;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        toolRegistry = mock(ToolRegistry.class);
        objectMapper = new ObjectMapper();
        meterRegistry = new SimpleMeterRegistry();

        // Setup d'un tool fictif "cancel_reservation" qui requiresConfirmation
        cancelReservationHandler = mock(ToolHandler.class);
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ToolDescriptor cancelDescriptor = ToolDescriptor.write(
                "cancel_reservation", "Annule une reservation (destructif)", schema);
        when(cancelReservationHandler.descriptor()).thenReturn(cancelDescriptor);
        when(toolRegistry.find("cancel_reservation"))
                .thenReturn(Optional.of(cancelReservationHandler));
        when(toolRegistry.listDescriptors()).thenReturn(List.of(cancelDescriptor));

        specialist = new TestSpecialist(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Test
    void specialist_throws_confirmation_required_when_llm_requests_write_tool() {
        // LLM demande l'execution de cancel_reservation
        ChatMessage.ToolCall toolCall = new ChatMessage.ToolCall(
                "tc-1", "cancel_reservation", "{\"reservation_id\":42}");
        stubLlm(List.of(toolCall));

        // Le specialist DOIT throw au lieu d'executer
        assertThatThrownBy(() -> specialist.handle(
                SpecialistRequest.of("annule ma reservation 42", AgentContext.minimal(1L, "kc"))))
                .isInstanceOf(ConfirmationRequiredException.class)
                .hasMessageContaining("cancel_reservation")
                .extracting(t -> ((ConfirmationRequiredException) t).toolName())
                .isEqualTo("cancel_reservation");

        // Securite critique : le handler N'A PAS ete invoke
        verify(cancelReservationHandler, never()).execute(any(), any());
    }

    @Test
    void confirmation_required_increments_dedicated_meter() {
        ChatMessage.ToolCall toolCall = new ChatMessage.ToolCall(
                "tc-1", "cancel_reservation", "{}");
        stubLlm(List.of(toolCall));

        try {
            specialist.handle(SpecialistRequest.of("annule", AgentContext.minimal(1L, "kc")));
        } catch (ConfirmationRequiredException ignored) {
            // Expected
        }

        // Un meter dedie est increment (pas le error meter generique)
        double confirmationCount = meterRegistry.counter("assistant.specialist.confirmation_required",
                "specialist", "test_specialist", "tool", "cancel_reservation").count();
        assertThat(confirmationCount).isEqualTo(1.0);

        double errorCount = meterRegistry.counter("assistant.specialist.errors",
                "specialist", "test_specialist").count();
        assertThat(errorCount).isZero();
    }

    @Test
    void specialist_injects_user_context_and_memory_in_system_prompt() {
        // Fix bloquant #5 : le specialist DOIT injecter user_context (langue,
        // page, propriete) + memory + RAG dans son system prompt pour produire
        // une reponse personnalisee.
        ToolHandler readHandler = mock(ToolHandler.class);
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ToolDescriptor readDescriptor = ToolDescriptor.readOnly(
                "list_properties", "Liste", schema);
        when(readHandler.descriptor()).thenReturn(readDescriptor);
        when(readHandler.execute(any(), any())).thenReturn(ToolResult.success("{}", "table"));
        when(toolRegistry.find("list_properties")).thenReturn(Optional.of(readHandler));
        when(toolRegistry.listDescriptors()).thenReturn(List.of(readDescriptor));

        TestSpecialist spec = new TestSpecialist(chatProvider, toolRegistry,
                objectMapper, meterRegistry, Set.of("list_properties"));

        // LLM stub : repond directement avec texte (pas de tool call)
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.TextDelta("You have 5 properties."));
            consumer.accept(new ChatEvent.Done(20, 8, "claude", "end_turn", "You have 5 properties."));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        AgentContext ctx = new AgentContext(1L, "kc", null, "en", "/properties", 42L);
        AssistantMemory memory = new AssistantMemory(1L, "kc", "currency", "USD",
                AssistantMemory.Scope.PREFERENCE);
        SpecialistRequest req = SpecialistRequest.of("list", ctx,
                new OrchestrationContext(List.of(memory), List.of()));

        spec.handle(req);

        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        String sysPrompt = reqCaptor.getValue().systemPrompt();
        assertThat(sysPrompt)
                .contains("<user_context>")
                .contains("<language>en</language>")
                .contains("<current_page>/properties</current_page>")
                .contains("<selected_property_id>42</selected_property_id>")
                .contains("<memory>")
                .contains("key=\"currency\"")
                .contains("USD")
                .contains("<role>");
    }

    @Test
    void read_only_tool_executes_normally_no_exception() {
        // Setup d'un tool read-only
        ToolHandler readHandler = mock(ToolHandler.class);
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ToolDescriptor readDescriptor = ToolDescriptor.readOnly(
                "list_properties", "Liste les proprietes", schema);
        when(readHandler.descriptor()).thenReturn(readDescriptor);
        when(readHandler.execute(any(), any())).thenReturn(ToolResult.success("{}", "table"));
        when(toolRegistry.find("list_properties")).thenReturn(Optional.of(readHandler));
        when(toolRegistry.listDescriptors()).thenReturn(List.of(readDescriptor));

        TestSpecialist readSpec = new TestSpecialist(chatProvider, toolRegistry,
                objectMapper, meterRegistry, Set.of("list_properties"));

        // Tour 1 : tool_call. Tour 2 : reponse texte.
        ChatMessage.ToolCall toolCall = new ChatMessage.ToolCall(
                "tc-1", "list_properties", "{}");
        AtomicInteger callCount = new AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount.getAndIncrement() == 0) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(toolCall)));
                consumer.accept(new ChatEvent.Done(10, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Tu as 3 biens."));
                consumer.accept(new ChatEvent.Done(20, 8, "claude", "end_turn", "Tu as 3 biens."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        SpecialistResult result = readSpec.handle(
                SpecialistRequest.of("liste mes biens", AgentContext.minimal(1L, "kc")));

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.synthesis()).contains("3 biens");
        verify(readHandler).execute(any(), any());
    }

    /** Stub : LLM emet un seul tour avec les tool_calls fournis. */
    private void stubLlm(List<ChatMessage.ToolCall> toolCalls) {
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (!toolCalls.isEmpty()) {
                consumer.accept(new ChatEvent.ToolCallRequest(toolCalls));
            }
            consumer.accept(new ChatEvent.Done(20, 5, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }

    /** Specialist de test minimal qui delegue aux tools fournis. */
    private static class TestSpecialist extends AbstractAgentSpecialist {
        private final Set<String> tools;

        TestSpecialist(ChatLLMProvider chatProvider, ToolRegistry toolRegistry,
                       ObjectMapper objectMapper, MeterRegistry meterRegistry) {
            this(chatProvider, toolRegistry, objectMapper, meterRegistry,
                    Set.of("cancel_reservation"));
        }

        TestSpecialist(ChatLLMProvider chatProvider, ToolRegistry toolRegistry,
                       ObjectMapper objectMapper, MeterRegistry meterRegistry,
                       Set<String> tools) {
            super(chatProvider, toolRegistry, objectMapper, meterRegistry);
            this.tools = tools;
        }

        @Override public String name() { return "test_specialist"; }
        @Override public String domain() { return "test"; }
        @Override public String description() { return "Test"; }
        @Override public Set<String> toolNames() { return tools; }
    }
}
