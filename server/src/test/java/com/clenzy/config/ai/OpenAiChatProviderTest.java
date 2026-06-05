package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
 * Tests unitaires de {@link OpenAiChatProvider} — focalises sur les deux pieces
 * non-reseau : construction du body OpenAI (messages/tools/stream) et parsing du
 * flux SSE (text deltas, tool_calls accumules par index, usage final).
 */
class OpenAiChatProviderTest {

    private AiProperties aiProperties;
    private ObjectMapper objectMapper;
    private OpenAiChatProvider provider;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getOpenai().setApiKey("sk-openai-test");
        aiProperties.getOpenai().setModel("gpt-4o");
        objectMapper = new ObjectMapper();
        provider = new OpenAiChatProvider(aiProperties, objectMapper,
                mock(ApplicationEventPublisher.class));
    }

    private ObjectNode emptyObjectSchema() {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        schema.set("properties", objectMapper.createObjectNode());
        return schema;
    }

    @Test
    void name_returnsOpenai() {
        assertEquals("openai", provider.name());
    }

    // ─── Request body ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("buildRequestBody")
    class BuildRequestBody {

        @SuppressWarnings("unchecked")
        @Test
        void systemPromptBecomesFirstMessage_andStreamFlagsSet() {
            ChatRequest req = new ChatRequest("Tu es un assistant.",
                    List.of(ChatMessage.user("Bonjour")), List.of(), "gpt-4o", 0.3, 1000);

            Map<String, Object> body = provider.buildRequestBody(req, "gpt-4o");

            assertEquals("gpt-4o", body.get("model"));
            assertEquals(Boolean.TRUE, body.get("stream"));
            assertEquals(Map.of("include_usage", true), body.get("stream_options"));

            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            assertEquals(2, messages.size());
            assertEquals("system", messages.get(0).get("role"));
            assertEquals("Tu es un assistant.", messages.get(0).get("content"));
            assertEquals("user", messages.get(1).get("role"));
            assertEquals("Bonjour", messages.get(1).get("content"));
        }

        @SuppressWarnings("unchecked")
        @Test
        void toolsUseFunctionSchema() {
            ChatRequest req = new ChatRequest("sys", List.of(ChatMessage.user("hi")),
                    List.of(ToolDescriptor.readOnly("list_reservations", "Liste les reservations", emptyObjectSchema())),
                    "gpt-4o", 0.3, 1000);

            Map<String, Object> body = provider.buildRequestBody(req, "gpt-4o");

            List<Map<String, Object>> tools = (List<Map<String, Object>>) body.get("tools");
            assertEquals(1, tools.size());
            assertEquals("function", tools.get(0).get("type"));
            Map<String, Object> fn = (Map<String, Object>) tools.get(0).get("function");
            assertEquals("list_reservations", fn.get("name"));
            assertEquals("Liste les reservations", fn.get("description"));
            assertNotNull(fn.get("parameters"));
        }

        @SuppressWarnings("unchecked")
        @Test
        void assistantToolCallsAndToolResult_roundTripToOpenAiShape() {
            ChatMessage assistant = ChatMessage.assistantToolCalls(
                    List.of(new ChatMessage.ToolCall("call_1", "list_reservations", "{\"limit\":5}")));
            ChatMessage toolResult = ChatMessage.tool("call_1", "{\"count\":3}");
            ChatRequest req = new ChatRequest("sys",
                    List.of(ChatMessage.user("liste"), assistant, toolResult),
                    List.of(), "gpt-4o", 0.3, 1000);

            Map<String, Object> body = provider.buildRequestBody(req, "gpt-4o");
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            // system + user + assistant(tool_calls) + tool
            assertEquals(4, messages.size());

            Map<String, Object> asst = messages.get(2);
            assertEquals("assistant", asst.get("role"));
            List<Map<String, Object>> calls = (List<Map<String, Object>>) asst.get("tool_calls");
            assertEquals(1, calls.size());
            assertEquals("call_1", calls.get(0).get("id"));
            assertEquals("function", calls.get(0).get("type"));
            assertEquals("list_reservations", ((Map<String, Object>) calls.get(0).get("function")).get("name"));

            Map<String, Object> tool = messages.get(3);
            assertEquals("tool", tool.get("role"));
            assertEquals("call_1", tool.get("tool_call_id"));
            assertEquals("{\"count\":3}", tool.get("content"));
        }

        @SuppressWarnings("unchecked")
        @Test
        void userImageAttachment_becomesImageUrlBlock() {
            MessageAttachment att = MessageAttachment.imageBase64("image/png", "B64DATA");
            ChatRequest req = new ChatRequest("sys",
                    List.of(ChatMessage.user("Regarde", List.of(att))), List.of(), "gpt-4o", 0.3, 1000);

            Map<String, Object> body = provider.buildRequestBody(req, "gpt-4o");
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            Map<String, Object> userMsg = messages.get(1);
            List<Map<String, Object>> blocks = (List<Map<String, Object>>) userMsg.get("content");
            // text block + image_url block
            assertTrue(blocks.stream().anyMatch(b -> "image_url".equals(b.get("type"))));
            Map<String, Object> img = blocks.stream()
                    .filter(b -> "image_url".equals(b.get("type"))).findFirst().orElseThrow();
            Map<String, Object> imageUrl = (Map<String, Object>) img.get("image_url");
            assertEquals("data:image/png;base64,B64DATA", imageUrl.get("url"));
        }
    }

    // ─── SSE parsing ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("parseStream")
    class ParseStream {

        @Test
        void textDeltasAndUsage_emitsTextThenDone() {
            List<ChatEvent> events = new ArrayList<>();
            Stream<String> sse = Stream.of(
                    "data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"content\":\"Bonjour\"},\"finish_reason\":null}]}",
                    "data: {\"choices\":[{\"delta\":{\"content\":\" monde\"},\"finish_reason\":null}]}",
                    "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}",
                    "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":3}}",
                    "data: [DONE]");

            provider.parseStream(sse, "gpt-4o", events::add);

            long deltas = events.stream().filter(e -> e instanceof ChatEvent.TextDelta).count();
            assertEquals(2, deltas);
            ChatEvent last = events.get(events.size() - 1);
            assertInstanceOf(ChatEvent.Done.class, last);
            ChatEvent.Done done = (ChatEvent.Done) last;
            assertEquals("Bonjour monde", done.fullText());
            assertEquals(10, done.promptTokens());
            assertEquals(3, done.completionTokens());
            assertEquals("stop", done.finishReason());
            assertEquals("gpt-4o", done.model());
        }

        @Test
        void streamedToolCall_accumulatesArgumentsByIndex() {
            List<ChatEvent> events = new ArrayList<>();
            Stream<String> sse = Stream.of(
                    "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"list_reservations\",\"arguments\":\"\"}}]},\"finish_reason\":null}]}",
                    "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"limit\\\":5}\"}}]},\"finish_reason\":null}]}",
                    "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}",
                    "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":20,\"completion_tokens\":8}}",
                    "data: [DONE]");

            provider.parseStream(sse, "gpt-4o", events::add);

            ChatEvent.ToolCallRequest tcr = events.stream()
                    .filter(e -> e instanceof ChatEvent.ToolCallRequest)
                    .map(e -> (ChatEvent.ToolCallRequest) e)
                    .findFirst().orElseThrow();
            assertEquals(1, tcr.calls().size());
            ChatMessage.ToolCall call = tcr.calls().get(0);
            assertEquals("call_1", call.id());
            assertEquals("list_reservations", call.name());
            assertEquals("{\"limit\":5}", call.arguments());

            ChatEvent.Done done = (ChatEvent.Done) events.get(events.size() - 1);
            assertEquals("tool_calls", done.finishReason());
        }
    }
}
