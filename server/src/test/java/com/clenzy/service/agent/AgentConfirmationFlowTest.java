package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantConversation;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tests du flow write tools + confirmation utilisateur.
 *
 * <p>Verifie que :
 * <ul>
 *   <li>Un tool {@code requiresConfirmation=true} fait SUSPENDRE l'execution
 *       et emet un evenement {@code tool_confirmation_request} (pas execute)</li>
 *   <li>L'entree est persistee dans PendingToolStore</li>
 *   <li>{@code resumeAfterConfirmation(true)} execute le tool + relance le LLM</li>
 *   <li>{@code resumeAfterConfirmation(false)} skip l'execution + ecrit un
 *       tool_result "annule" et relance le LLM</li>
 *   <li>Mismatch d'ownership sur le store rejette</li>
 * </ul>
 */
class AgentConfirmationFlowTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private OrgAiApiKeyRepository keyRepo;
    private PendingToolStore pendingStore;
    private AgentOrchestrator orchestrator;
    private ObjectMapper om;
    private AgentContext ctx;
    private FakeWriteTool fakeWriteTool;

    @BeforeEach
    void setUp() {
        om = new ObjectMapper();
        chatProvider = mock(ChatLLMProvider.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        keyRepo = mock(OrgAiApiKeyRepository.class);
        pendingStore = new PendingToolStore();

        fakeWriteTool = new FakeWriteTool(om);
        toolRegistry = new ToolRegistry(List.of(fakeWriteTool));

        AssistantMemoryService memoryService = mock(AssistantMemoryService.class);
        when(memoryService.listForUser(anyString(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(List.of());
        when(memoryService.listMostRelevant(org.mockito.ArgumentMatchers.anyLong(),
                        anyString(), anyString(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(List.of());

        orchestrator = new AgentOrchestrator(chatProvider, toolRegistry,
                convRepo, msgRepo, om, keyRepo, new AiProperties(), pendingStore, memoryService,
                mock(com.clenzy.service.PhotoStorageService.class),
                mock(com.clenzy.service.agent.kb.KbSearchService.class),
                mock(com.clenzy.service.agent.prompt.PromptBuilder.class),
                mock(com.clenzy.service.agent.multiagent.OrchestratorAgent.class),
                mock(com.clenzy.service.agent.multiagent.SpecialistRegistry.class),
                false,  // v2 prompt off
                false); // multi-agent off : on teste le flow confirmation, pas le prompt

        ctx = AgentContext.minimal(1L, "user-confirm-test");

        AssistantConversation saved = new AssistantConversation(1L, "user-confirm-test");
        saved.setId(50L);
        when(convRepo.save(any())).thenReturn(saved);
        when(convRepo.findByIdAndUser(50L, "user-confirm-test")).thenReturn(Optional.of(saved));
        when(msgRepo.findByConversation(50L)).thenReturn(List.of(
                com.clenzy.model.AssistantMessage.user(50L, 1L, "bloque le calendrier")
        ));
        when(msgRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString())).thenReturn(Optional.empty());
    }

    @Test
    void writeTool_pausesAndEmitsConfirmationRequest_notExecutedImmediately() {
        // LLM emet un tool_call sur le fake write tool
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_block_1", "fake_write",
                            "{\"target\":\"prop-42\"}")
            )));
            consumer.accept(new ChatEvent.Done(40, 15, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "bloque le calendrier", ctx, events::add);

        // Tool NOT executed (counter still 0)
        assertEquals(0, fakeWriteTool.execCount.get(),
                "write tool ne doit PAS s'executer sans confirmation");

        // Stream emet tool_confirmation_request + paused_awaiting_confirmation
        assertTrue(events.stream().anyMatch(e -> "tool_confirmation_request".equals(e.type())));
        assertTrue(events.stream().anyMatch(e -> "paused_awaiting_confirmation".equals(e.type())));

        AgentSseEvent confEvent = events.stream()
                .filter(e -> "tool_confirmation_request".equals(e.type())).findFirst().orElseThrow();
        assertEquals("fake_write", confEvent.toolName());
        assertEquals("toolu_block_1", confEvent.toolCallId());
        assertEquals("{\"target\":\"prop-42\"}", confEvent.toolArgs());
        assertNotNull(confEvent.toolDescription());

        // PendingToolStore contient l'entree
        assertEquals(1, pendingStore.size());

        // Pas de "done" final
        assertFalse(events.stream().anyMatch(e -> "done".equals(e.type())));

        // Un seul appel LLM (le 2e tour ne s'est pas declenche)
        verify(chatProvider, times(1)).streamChat(any(ChatRequest.class), any());
    }

    @Test
    void resumeAfterConfirmation_confirmed_executesToolAndContinuesLoop() {
        // Setup : pause initiale
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_X", "fake_write", "{\"target\":\"P-1\"}")
            )));
            consumer.accept(new ChatEvent.Done(40, 15, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        orchestrator.handleMessage(null, "fais l'action", ctx, e -> {});
        assertEquals(1, pendingStore.size());

        // Reprise : ré-arm le mock pour le 2e tour LLM qui fait juste une reponse texte
        reset(chatProvider);
        doAnswer(inv -> {
            ChatRequest req = inv.getArgument(0);
            // L'historique doit contenir : user + assistant tool_calls + tool result
            assertEquals(3, req.messages().size());
            assertEquals(ChatMessage.ROLE_TOOL, req.messages().get(2).role());
            // Le tool result doit contenir le succes du fake tool
            assertTrue(req.messages().get(2).content().contains("\"executed\":true"));

            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.TextDelta("OK"));
            consumer.accept(new ChatEvent.Done(60, 5, "claude", "end_turn", "OK"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> resumeEvents = new ArrayList<>();
        orchestrator.resumeAfterConfirmation("toolu_X", true, ctx, resumeEvents::add);

        // Le tool a ete execute (compteur incremente)
        assertEquals(1, fakeWriteTool.execCount.get());

        // SSE : tool_call_executed + text_delta + done
        assertTrue(resumeEvents.stream().anyMatch(e -> "tool_call_executed".equals(e.type())));
        assertTrue(resumeEvents.stream().anyMatch(e -> "text_delta".equals(e.type())));
        assertTrue(resumeEvents.stream().anyMatch(e -> "done".equals(e.type())));

        // PendingToolStore est consume
        assertEquals(0, pendingStore.size());
    }

    @Test
    void resumeAfterConfirmation_refused_skipsExecutionAndContinuesLoop() {
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_Y", "fake_write", "{}")
            )));
            consumer.accept(new ChatEvent.Done(40, 15, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        orchestrator.handleMessage(null, "fais ca", ctx, e -> {});

        // Reprise REFUSED
        reset(chatProvider);
        doAnswer(inv -> {
            ChatRequest req = inv.getArgument(0);
            // tool result doit contenir "L'utilisateur a refuse"
            assertTrue(req.messages().get(2).content().contains("refuse"));

            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.TextDelta("Action annulee"));
            consumer.accept(new ChatEvent.Done(50, 5, "claude", "end_turn", "Action annulee"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.resumeAfterConfirmation("toolu_Y", false, ctx, events::add);

        // Tool NOT executed (refused)
        assertEquals(0, fakeWriteTool.execCount.get());

        // SSE tool_call_executed avec is_error=true (refus = erreur cote tool result)
        AgentSseEvent toolEvent = events.stream()
                .filter(e -> "tool_call_executed".equals(e.type())).findFirst().orElseThrow();
        assertTrue(toolEvent.toolError());
    }

    @Test
    void resumeAfterConfirmation_wrongUser_rejected() {
        // Setup une pause avec user A
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_OWN", "fake_write", "{}"))));
            consumer.accept(new ChatEvent.Done(10, 5, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        orchestrator.handleMessage(null, "fais", ctx, e -> {});

        // Tentative de reprise par user B
        AgentContext otherUser = AgentContext.minimal(1L, "different-user");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> orchestrator.resumeAfterConfirmation("toolu_OWN", true, otherUser, e -> {}));
        assertTrue(ex.getMessage().contains("toolu_OWN"));

        // Le tool n'a PAS ete execute
        assertEquals(0, fakeWriteTool.execCount.get());
    }

    @Test
    void resumeAfterConfirmation_unknownToolCallId_rejected() {
        assertThrows(IllegalArgumentException.class,
                () -> orchestrator.resumeAfterConfirmation("does-not-exist", true, ctx, e -> {}));
    }

    // ─── Fake write tool ─────────────────────────────────────────────────

    private static class FakeWriteTool implements ToolHandler {
        final AtomicInteger execCount = new AtomicInteger(0);
        private final ObjectMapper om;
        private final ToolDescriptor descriptor;

        FakeWriteTool(ObjectMapper om) {
            this.om = om;
            try {
                JsonNode schema = om.readTree(
                        "{\"type\":\"object\",\"properties\":{\"target\":{\"type\":\"string\"}}}");
                this.descriptor = ToolDescriptor.write("fake_write",
                        "Fake write tool for tests (requires confirmation).", schema);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        @Override public String name() { return "fake_write"; }
        @Override public ToolDescriptor descriptor() { return descriptor; }

        @Override
        public ToolResult execute(JsonNode args, AgentContext context) {
            execCount.incrementAndGet();
            try {
                return ToolResult.success(
                        om.writeValueAsString(java.util.Map.of(
                                "executed", true,
                                "target", args.path("target").asText("none"))),
                        "summary");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
