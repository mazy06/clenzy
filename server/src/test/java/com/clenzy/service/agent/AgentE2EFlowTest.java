package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Test integration de la boucle complete de l'agent :
 *
 * <p>Stub un {@link ChatLLMProvider} qui simule une vraie conversation
 * Anthropic en 2 tours (tool call → puis reponse texte), branche une vraie
 * implementation de {@link ToolRegistry} avec un {@link ToolHandler} fonctionnel,
 * et verifie de bout en bout que :
 * <ul>
 *   <li>Le user message est persiste</li>
 *   <li>Le LLM est appele avec la liste des tools</li>
 *   <li>Le tool est execute avec les args parses</li>
 *   <li>Le resultat est renvoye au LLM dans le tour suivant</li>
 *   <li>La reponse finale est persistee et streamee au consumer</li>
 *   <li>Les events SSE arrivent dans le bon ordre</li>
 * </ul>
 *
 * <p>Cette boucle est la promesse principale du Jalon 4 : 4 tools read-only
 * exposes au LLM, qui les appelle au besoin et formule sa reponse.</p>
 */
class AgentE2EFlowTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private OrgAiApiKeyRepository keyRepo;
    private AgentOrchestrator orchestrator;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        om = new ObjectMapper();
        chatProvider = mock(ChatLLMProvider.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        keyRepo = mock(OrgAiApiKeyRepository.class);

        // Wire a REAL ToolRegistry with a real ToolHandler (not a mock).
        toolRegistry = new ToolRegistry(List.of(new FakeListPropertiesTool(om)));

        AssistantMemoryService memoryService = mock(AssistantMemoryService.class);
        when(memoryService.listForUser(anyString(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(List.of());

        orchestrator = new AgentOrchestrator(chatProvider, toolRegistry,
                convRepo, msgRepo, om, keyRepo, new AiProperties(), new PendingToolStore(),
                memoryService);

        ctx = AgentContext.minimal(1L, "user-e2e");

        // Repos behavior : retourne une vraie nouvelle conv avec id 100
        AtomicLong idGen = new AtomicLong(100);
        when(convRepo.save(any())).thenAnswer(inv -> {
            AssistantConversation c = inv.getArgument(0);
            if (c.getId() == null) c.setId(idGen.getAndIncrement());
            return c;
        });
        // Au moment du findByConversation, on retourne SEULEMENT le user message
        // (l'orchestrateur ne persiste pas encore les messages assistant en cours
        // de boucle dans ce test, on simule le state au moment T0).
        AssistantMessage userMsg = AssistantMessage.user(100L, 1L, "Combien de proprietes ?");
        userMsg.setId(1L);
        when(msgRepo.findByConversation(100L)).thenReturn(List.of(userMsg));
        when(msgRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString())).thenReturn(Optional.empty());
    }

    @Test
    void fullToolCallingLoop_endsWithTextResponse_andCorrectPersistOrder() {
        // ── LLM simulation ──────────────────────────────────────────────
        // Tour 1 : "je dois appeler list_properties" → emet ToolCallRequest + Done
        // Tour 2 : LLM lit le resultat tool → repond en texte "Tu as 2 proprietes"
        int[] turn = {0};
        doAnswer(inv -> {
            ChatRequest req = inv.getArgument(0);
            @SuppressWarnings("unchecked")
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            turn[0]++;
            if (turn[0] == 1) {
                // 1er appel : le LLM doit voir le user message
                assertEquals(1, req.messages().size(), "premier tour : juste le user message");
                assertEquals(ChatMessage.ROLE_USER, req.messages().get(0).role());
                // ET il doit avoir notre tool dans la liste
                assertEquals(1, req.tools().size());
                assertEquals("list_properties", req.tools().get(0).name());

                // Le LLM decide d'appeler le tool
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_abc", "list_properties",
                                "{\"limit\":10}"))));
                consumer.accept(new ChatEvent.Done(45, 12, "claude-sonnet-4", "tool_use", ""));
            } else {
                // 2e appel : le LLM doit voir [user, assistant tool_call, tool result]
                assertEquals(3, req.messages().size(), "2e tour : user + assistant + tool result");
                assertEquals(ChatMessage.ROLE_USER, req.messages().get(0).role());
                assertEquals(ChatMessage.ROLE_ASSISTANT, req.messages().get(1).role());
                assertNotNull(req.messages().get(1).toolCalls());
                assertEquals(ChatMessage.ROLE_TOOL, req.messages().get(2).role());
                // Le tool result doit contenir la donnee retournee par FakeListPropertiesTool
                assertTrue(req.messages().get(2).content().contains("Loft Bastille"),
                        "Le LLM doit voir le contenu retourne par le tool");

                consumer.accept(new ChatEvent.TextDelta("Tu as "));
                consumer.accept(new ChatEvent.TextDelta("2 proprietes."));
                consumer.accept(new ChatEvent.Done(70, 8, "claude-sonnet-4", "end_turn", "Tu as 2 proprietes."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        // ── Exec ────────────────────────────────────────────────────────
        List<AgentSseEvent> events = new ArrayList<>();
        Long convId = orchestrator.handleMessage(null, "Combien de proprietes ?",
                ctx, events::add);

        // ── Assertions ──────────────────────────────────────────────────
        assertEquals(100L, convId);

        // 2 tours LLM
        verify(chatProvider, times(2)).streamChat(any(ChatRequest.class), any());

        // Events SSE doivent etre dans cet ordre :
        //   1. conversation_created
        //   2. tool_call_executed (notre tool fake)
        //   3. text_delta x2
        //   4. done
        List<String> eventTypes = events.stream().map(AgentSseEvent::type).toList();
        assertEquals("conversation_created", eventTypes.get(0));
        assertTrue(eventTypes.contains("tool_call_executed"),
                "Le frontend doit voir le tool execute");
        AgentSseEvent toolEvent = events.stream()
                .filter(e -> "tool_call_executed".equals(e.type())).findFirst().orElseThrow();
        assertEquals("list_properties", toolEvent.toolName());
        assertFalse(toolEvent.toolError());
        assertEquals("list", toolEvent.displayHint());

        // Au moins 2 text_delta
        long deltaCount = events.stream().filter(e -> "text_delta".equals(e.type())).count();
        assertEquals(2, deltaCount);

        // Termine par "done"
        AgentSseEvent done = events.get(events.size() - 1);
        assertEquals("done", done.type());
        assertEquals("end_turn", done.finishReason());

        // Persistance : verify le bon nombre de saves
        //   1 user message (en debut de handleMessage)
        //   1 assistant message (tour 1, avec tool_calls)
        //   1 tool result message (tour 1, retour du tool)
        //   1 assistant message (tour 2, avec le texte final)
        //   + 1 save de la conv (initial) + 1 save de la conv (update updatedAt/title)
        verify(msgRepo, times(4)).save(any(AssistantMessage.class));
        verify(convRepo, times(2)).save(any(AssistantConversation.class));
    }

    @Test
    void multipleToolCalls_inSingleTurn_areAllExecuted() {
        // Le LLM peut emettre PLUSIEURS tool_calls en un seul tour (parallel tool use).
        // Verifie que l'orchestrateur les execute tous et envoie tous les resultats.
        int[] turn = {0};
        doAnswer(inv -> {
            @SuppressWarnings("unchecked")
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            turn[0]++;
            if (turn[0] == 1) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_1", "list_properties", "{\"city\":\"Paris\"}"),
                        new ChatMessage.ToolCall("toolu_2", "list_properties", "{\"city\":\"Lyon\"}")
                )));
                consumer.accept(new ChatEvent.Done(50, 20, "claude-sonnet-4", "tool_use", ""));
            } else {
                ChatRequest req = inv.getArgument(0);
                // 4 messages : user + assistant (avec 2 tool_calls) + 2 tool results
                assertEquals(4, req.messages().size());
                assertEquals(ChatMessage.ROLE_TOOL, req.messages().get(2).role());
                assertEquals(ChatMessage.ROLE_TOOL, req.messages().get(3).role());

                consumer.accept(new ChatEvent.TextDelta("Resultats consolides"));
                consumer.accept(new ChatEvent.Done(80, 5, "claude", "end_turn", "Resultats consolides"));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "compare Paris et Lyon", ctx, events::add);

        long toolEvents = events.stream().filter(e -> "tool_call_executed".equals(e.type())).count();
        assertEquals(2, toolEvents, "2 tool_call_executed dans l'ordre");
    }

    // ─── Fake tool : retourne une donnee deterministe ───────────────────

    /**
     * Implementation reelle (pas mock) d'un ToolHandler pour valider toute la
     * chaine : parsing args, execution, serialisation du resultat.
     */
    private static class FakeListPropertiesTool implements ToolHandler {
        private final ObjectMapper om;
        private final ToolDescriptor descriptor;

        FakeListPropertiesTool(ObjectMapper om) {
            this.om = om;
            try {
                JsonNode schema = om.readTree(
                        "{\"type\":\"object\",\"properties\":{"
                                + "\"city\":{\"type\":\"string\"},"
                                + "\"limit\":{\"type\":\"integer\"}}}");
                this.descriptor = ToolDescriptor.readOnly("list_properties",
                        "Liste les proprietes", schema);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        @Override public String name() { return "list_properties"; }
        @Override public ToolDescriptor descriptor() { return descriptor; }

        @Override
        public ToolResult execute(JsonNode args, AgentContext context) {
            // Lit les args pour prouver que le parsing JSON marche
            String city = args.path("city").asText("ALL");
            int limit = args.path("limit").asInt(20);
            try {
                Map<String, Object> payload = new HashMap<>();
                List<Map<String, Object>> items = new ArrayList<>();
                Map<String, Object> p = new HashMap<>();
                p.put("id", 1);
                p.put("name", "Loft Bastille");
                p.put("city", city);
                items.add(p);
                payload.put("items", items);
                payload.put("count", items.size());
                payload.put("limitRequested", limit);
                return ToolResult.success(om.writeValueAsString(payload), "list");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
