package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Tests unitaires de {@link AnthropicChatProvider} — focalises sur les deux
 * pieces non-reseau : construction du body et parsing du flux SSE.
 */
class AnthropicChatProviderTest {

    private AiProperties aiProperties;
    private ObjectMapper objectMapper;
    private AnthropicChatProvider provider;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getAnthropic().setApiKey("sk-ant-test");
        aiProperties.getAnthropic().setModel("claude-sonnet-4-20250514");
        objectMapper = new ObjectMapper();
        provider = new AnthropicChatProvider(aiProperties, objectMapper,
                mock(ApplicationEventPublisher.class));
    }

    @Test
    void name_returnsAnthropic() {
        assertEquals("anthropic", provider.name());
    }

    // ─── Vision blocks ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @Test
    void userMessageWithImageAttachment_emitsImageContentBlock() {
        MessageAttachment att = MessageAttachment.imageBase64("image/jpeg", "BASE64DATA");
        ChatMessage userMsg = ChatMessage.user("Regarde cette photo", List.of(att));
        ChatRequest req = new ChatRequest("sys", List.of(userMsg), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);

        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        assertEquals(1, messages.size());
        Map<String, Object> first = messages.get(0);
        assertEquals("user", first.get("role"));

        Object content = first.get("content");
        assertTrue(content instanceof List, "content doit etre une liste de blocks quand il y a une image");
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) content;
        assertEquals(2, blocks.size(), "1 block image + 1 block text");

        // Block 0 : image (ordre important — l'image vient avant le texte)
        Map<String, Object> imageBlock = blocks.get(0);
        assertEquals("image", imageBlock.get("type"));
        Map<String, Object> source = (Map<String, Object>) imageBlock.get("source");
        assertEquals("base64", source.get("type"));
        assertEquals("image/jpeg", source.get("media_type"));
        assertEquals("BASE64DATA", source.get("data"));

        // Block 1 : texte
        Map<String, Object> textBlock = blocks.get(1);
        assertEquals("text", textBlock.get("type"));
        assertEquals("Regarde cette photo", textBlock.get("text"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void userMessageWithMultipleAttachments_preservesOrder() {
        ChatMessage userMsg = ChatMessage.user("Compare", List.of(
                MessageAttachment.imageBase64("image/png", "A"),
                MessageAttachment.imageBase64("image/webp", "B"),
                MessageAttachment.imageBase64("image/jpeg", "C")
        ));
        ChatRequest req = new ChatRequest("sys", List.of(userMsg), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);

        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) messages.get(0).get("content");

        // 3 images + 1 text
        assertEquals(4, blocks.size());
        assertEquals("image", blocks.get(0).get("type"));
        assertEquals("A", ((Map<String, Object>) blocks.get(0).get("source")).get("data"));
        assertEquals("B", ((Map<String, Object>) blocks.get(1).get("source")).get("data"));
        assertEquals("C", ((Map<String, Object>) blocks.get(2).get("source")).get("data"));
        assertEquals("text", blocks.get(3).get("type"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void unsupportedMediaType_isSkipped_textBlockStillEmitted() {
        ChatMessage userMsg = ChatMessage.user("Test", List.of(
                MessageAttachment.imageBase64("application/pdf", "ZZZ") // PDF non supporte
        ));
        ChatRequest req = new ChatRequest("sys", List.of(userMsg), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);

        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        Map<String, Object> msg = ((List<Map<String, Object>>) body.get("messages")).get(0);
        // L'image PDF est filtree, mais le contenu texte reste — il est emis
        // comme une liste a un seul element text (equivalent semantique a une string
        // pour Anthropic).
        Object content = msg.get("content");
        assertTrue(content instanceof List,
                "content devient une liste avec uniquement le text block");
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) content;
        assertEquals(1, blocks.size());
        assertEquals("text", blocks.get(0).get("type"));
        assertEquals("Test", blocks.get(0).get("text"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void allInvalidImagesAndBlankContent_fallbackToString() {
        // Seul cas ou on retombe sur string : aucun block valide ET pas de texte
        ChatMessage userMsg = ChatMessage.user("", List.of(
                MessageAttachment.imageBase64("application/pdf", "ZZZ")
        ));
        ChatRequest req = new ChatRequest("sys", List.of(userMsg), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);

        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        Map<String, Object> msg = ((List<Map<String, Object>>) body.get("messages")).get(0);
        assertTrue(msg.get("content") instanceof String);
        assertEquals("", msg.get("content"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void imageOnlyMessage_noText_emitsOnlyImageBlock() {
        ChatMessage userMsg = ChatMessage.user("", List.of(
                MessageAttachment.imageBase64("image/jpeg", "XYZ")
        ));
        ChatRequest req = new ChatRequest("sys", List.of(userMsg), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);

        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        Map<String, Object> msg = ((List<Map<String, Object>>) body.get("messages")).get(0);
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) msg.get("content");
        assertEquals(1, blocks.size());
        assertEquals("image", blocks.get(0).get("type"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void userMessageWithoutAttachments_keepsStringContent() {
        ChatRequest req = new ChatRequest("sys", List.of(ChatMessage.user("Bonjour")), List.of(),
                "claude-sonnet-4-20250514", 0.3, 2000);
        Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
        Map<String, Object> msg = ((List<Map<String, Object>>) body.get("messages")).get(0);
        // Pas d'attachments → content reste string brut (compat retro)
        assertTrue(msg.get("content") instanceof String);
        assertEquals("Bonjour", msg.get("content"));
    }

    @Nested
    @DisplayName("buildRequestBody()")
    class BuildRequestBody {

        @Test
        void simpleUserMessage_buildsExpectedShape() {
            ChatRequest req = new ChatRequest(
                    "Tu es un assistant.",
                    List.of(ChatMessage.user("Bonjour")),
                    List.of(),
                    "claude-sonnet-4-20250514",
                    0.3,
                    2000);

            Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");

            assertEquals("claude-sonnet-4-20250514", body.get("model"));
            assertEquals(2000, body.get("max_tokens"));
            assertEquals(true, body.get("stream"));
            assertEquals("Tu es un assistant.", body.get("system"));
            assertEquals(0.3, (double) body.get("temperature"), 0.0001);
            assertFalse(body.containsKey("tools"), "no tools => key absent");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            assertEquals(1, messages.size());
            assertEquals("user", messages.get(0).get("role"));
            assertEquals("Bonjour", messages.get(0).get("content"));
        }

        @Test
        void multiTurnConversation_keepsOrderAndRoles() {
            ChatRequest req = new ChatRequest(
                    null,
                    List.of(
                            ChatMessage.user("Combien j'ai de proprietes ?"),
                            ChatMessage.assistant("Tu en as 5."),
                            ChatMessage.user("Et de reservations ce mois-ci ?")
                    ),
                    List.of(),
                    null, 0.3, 1024);

            Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");

            assertFalse(body.containsKey("system"), "blank/null system => absent (Anthropic accepts no system)");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            assertEquals(3, messages.size());
            assertEquals("user", messages.get(0).get("role"));
            assertEquals("assistant", messages.get(1).get("role"));
            assertEquals("user", messages.get(2).get("role"));
        }

        @Test
        void assistantWithToolCalls_serializesAsBlocks() {
            ChatMessage assistantCall = ChatMessage.assistantToolCalls(List.of(
                    new ChatMessage.ToolCall("toolu_abc", "list_reservations",
                            "{\"limit\":10}")
            ));
            ChatMessage toolResult = ChatMessage.tool("toolu_abc", "{\"items\":[]}");
            ChatRequest req = new ChatRequest(
                    "sys",
                    List.of(
                            ChatMessage.user("Liste mes resa"),
                            assistantCall,
                            toolResult
                    ),
                    List.of(), null, 0.0, 1024);

            Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");

            // assistant turn -> role=assistant, content=[{type:tool_use, id, name, input}]
            Map<String, Object> assistant = messages.get(1);
            assertEquals("assistant", assistant.get("role"));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> blocks = (List<Map<String, Object>>) assistant.get("content");
            assertEquals(1, blocks.size());
            assertEquals("tool_use", blocks.get(0).get("type"));
            assertEquals("toolu_abc", blocks.get(0).get("id"));
            assertEquals("list_reservations", blocks.get(0).get("name"));
            assertEquals(Map.of("limit", 10), blocks.get(0).get("input"));

            // tool result -> Anthropic format = user with tool_result block
            Map<String, Object> tool = messages.get(2);
            assertEquals("user", tool.get("role"));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> toolContent = (List<Map<String, Object>>) tool.get("content");
            assertEquals(1, toolContent.size());
            assertEquals("tool_result", toolContent.get(0).get("type"));
            assertEquals("toolu_abc", toolContent.get(0).get("tool_use_id"));
            assertEquals("{\"items\":[]}", toolContent.get(0).get("content"));
        }

        @Test
        void toolsList_serializedWithInputSchema() throws Exception {
            JsonNode schema = objectMapper.readTree("""
                    {"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}
                    """);
            ToolDescriptor td = ToolDescriptor.readOnly("get_reservation",
                    "Recupere une reservation par id", schema);

            ChatRequest req = new ChatRequest(
                    "sys",
                    List.of(ChatMessage.user("hi")),
                    List.of(td),
                    null, 0.3, 1024);

            Map<String, Object> body = provider.buildRequestBody(req, "claude-sonnet-4-20250514");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> tools = (List<Map<String, Object>>) body.get("tools");
            assertEquals(1, tools.size());
            assertEquals("get_reservation", tools.get(0).get("name"));
            assertEquals("Recupere une reservation par id", tools.get(0).get("description"));
            assertEquals(schema, tools.get(0).get("input_schema"));
        }
    }

    @Nested
    @DisplayName("parseStream()")
    class ParseStream {

        @Test
        void textOnlyResponse_emitsDeltasAndDone() {
            String sse = """
                    event: message_start
                    data: {"type":"message_start","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":42,"output_tokens":0}}}

                    event: content_block_start
                    data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

                    event: content_block_delta
                    data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Bonjour "}}

                    event: content_block_delta
                    data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"le monde"}}

                    event: content_block_stop
                    data: {"type":"content_block_stop","index":0}

                    event: message_delta
                    data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

                    event: message_stop
                    data: {"type":"message_stop"}
                    """;

            List<ChatEvent> events = collect(sse, "claude-sonnet-4-20250514");

            // 2 text deltas + 1 done
            assertEquals(3, events.size());
            assertInstanceOf(ChatEvent.TextDelta.class, events.get(0));
            assertEquals("Bonjour ", ((ChatEvent.TextDelta) events.get(0)).delta());
            assertEquals("le monde", ((ChatEvent.TextDelta) events.get(1)).delta());

            ChatEvent.Done done = (ChatEvent.Done) events.get(2);
            assertEquals("Bonjour le monde", done.fullText());
            assertEquals(42, done.promptTokens());
            assertEquals(15, done.completionTokens());
            assertEquals("claude-sonnet-4-20250514", done.model());
            assertEquals("end_turn", done.finishReason());
        }

        @Test
        void toolUseResponse_emitsToolCallRequest() {
            String sse = """
                    data: {"type":"message_start","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":30,"output_tokens":0}}}

                    data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01ABC","name":"list_reservations","input":{}}}

                    data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"limit\\":"}}

                    data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"10}"}}

                    data: {"type":"content_block_stop","index":0}

                    data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}

                    data: {"type":"message_stop"}
                    """;

            List<ChatEvent> events = collect(sse, "claude-sonnet-4-20250514");

            // expect: ToolCallRequest + Done (no text deltas)
            assertEquals(2, events.size());

            ChatEvent.ToolCallRequest tcr = (ChatEvent.ToolCallRequest) events.get(0);
            assertEquals(1, tcr.calls().size());
            assertEquals("toolu_01ABC", tcr.calls().get(0).id());
            assertEquals("list_reservations", tcr.calls().get(0).name());
            assertEquals("{\"limit\":10}", tcr.calls().get(0).arguments());

            ChatEvent.Done done = (ChatEvent.Done) events.get(1);
            assertEquals("tool_use", done.finishReason());
        }

        @Test
        void emptyToolInput_defaultsToEmptyObject() {
            String sse = """
                    data: {"type":"message_start","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}

                    data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_X","name":"get_dashboard_summary","input":{}}}

                    data: {"type":"content_block_stop","index":0}

                    data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":5}}

                    data: {"type":"message_stop"}
                    """;
            List<ChatEvent> events = collect(sse, "claude-sonnet-4-20250514");
            ChatEvent.ToolCallRequest tcr = (ChatEvent.ToolCallRequest) events.get(0);
            assertEquals("{}", tcr.calls().get(0).arguments());
        }

        @Test
        void errorEvent_propagatesAsError() {
            String sse = """
                    data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}
                    """;
            List<ChatEvent> events = collect(sse, "claude-sonnet-4-20250514");
            // Error then Done (parseStream always emits Done at the end of the line stream)
            assertInstanceOf(ChatEvent.Error.class, events.get(0));
            assertTrue(((ChatEvent.Error) events.get(0)).message().contains("Overloaded"));
        }

        @Test
        void malformedJsonLine_doesNotCrash() {
            String sse = """
                    data: {"type":"message_start","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":5,"output_tokens":0}}}

                    data: {this is not valid json

                    data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

                    data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}

                    data: {"type":"content_block_stop","index":0}

                    data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}

                    data: {"type":"message_stop"}
                    """;
            List<ChatEvent> events = collect(sse, "claude-sonnet-4-20250514");
            // Should skip bad line and still emit text + done
            assertTrue(events.stream().anyMatch(e -> e instanceof ChatEvent.TextDelta));
            assertTrue(events.stream().anyMatch(e -> e instanceof ChatEvent.Done));
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private List<ChatEvent> collect(String sse, String modelHint) {
        List<ChatEvent> events = new ArrayList<>();
        Stream<String> lines = sse.lines();
        provider.parseStream(lines, modelHint, events::add);
        return events;
    }
}
