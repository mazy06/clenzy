package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    // ─── Backoff rate-limit (429 / 503 / timeout) ────────────────────────────

    @Nested
    @DisplayName("transient-retry backoff")
    class BackoffRetry {

        private ChatRequest simpleRequest() {
            return new ChatRequest("sys", List.of(ChatMessage.user("hi")),
                    List.of(), "gpt-4o", 0.3, 100, null, "openai", "https://api.test/v1");
        }

        @SuppressWarnings("unchecked")
        private HttpResponse<Stream<String>> response(int status, Stream<String> body) {
            HttpResponse<Stream<String>> resp = mock(HttpResponse.class);
            when(resp.statusCode()).thenReturn(status);
            when(resp.body()).thenReturn(body);
            return resp;
        }

        @Test
        void retriesOn429_thenSucceeds() throws Exception {
            HttpClient httpClient = mock(HttpClient.class);
            AtomicInteger call = new AtomicInteger();
            when(httpClient.send(any(), any())).thenAnswer(inv -> {
                if (call.getAndIncrement() == 0) {
                    return response(429, Stream.of("rate limited"));
                }
                return response(200, Stream.of(
                        "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"},\"finish_reason\":\"stop\"}]}",
                        "data: [DONE]"));
            });

            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(simpleRequest(), events::add);

            // 1 retry (2 appels send) puis succes -> pas d'Error, un Done.
            verify(httpClient, times(2)).send(any(), any());
            assertTrue(events.stream().noneMatch(e -> e instanceof ChatEvent.Error),
                    "aucun Error apres retry reussi");
            assertTrue(events.stream().anyMatch(e -> e instanceof ChatEvent.Done));
            assertTrue(events.stream().anyMatch(e -> e instanceof ChatEvent.TextDelta));
        }

        @Test
        void retriesExhaustedOn429_emitsError() throws Exception {
            HttpClient httpClient = mock(HttpClient.class);
            // Toujours 429 -> 1 essai initial + 2 retries = 3 appels, puis Error.
            when(httpClient.send(any(), any()))
                    .thenAnswer(inv -> response(429, Stream.of("rate limited")));

            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(simpleRequest(), events::add);

            verify(httpClient, times(3)).send(any(), any());
            ChatEvent.Error err = (ChatEvent.Error) events.stream()
                    .filter(e -> e instanceof ChatEvent.Error).findFirst().orElseThrow();
            assertTrue(err.message().contains("429"));
        }

        @Test
        void doesNotRetryOn401_emitsErrorImmediately() throws Exception {
            HttpClient httpClient = mock(HttpClient.class);
            when(httpClient.send(any(), any()))
                    .thenAnswer(inv -> response(401, Stream.of("invalid key")));

            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(simpleRequest(), events::add);

            // 4xx non-429 = definitif : un seul appel, pas de retry.
            verify(httpClient, times(1)).send(any(), any());
            ChatEvent.Error err = (ChatEvent.Error) events.stream()
                    .filter(e -> e instanceof ChatEvent.Error).findFirst().orElseThrow();
            assertTrue(err.message().contains("401"));
        }

        @Test
        void retriesOnTimeout_thenSucceeds() throws Exception {
            HttpClient httpClient = mock(HttpClient.class);
            AtomicInteger call = new AtomicInteger();
            when(httpClient.send(any(), any())).thenAnswer(inv -> {
                if (call.getAndIncrement() == 0) {
                    throw new java.net.http.HttpTimeoutException("timeout");
                }
                return response(200, Stream.of(
                        "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"},\"finish_reason\":\"stop\"}]}",
                        "data: [DONE]"));
            });

            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(simpleRequest(), events::add);

            verify(httpClient, times(2)).send(any(), any());
            assertTrue(events.stream().noneMatch(e -> e instanceof ChatEvent.Error));
            assertTrue(events.stream().anyMatch(e -> e instanceof ChatEvent.Done));
        }
    }

    // ─── Guard clauses : cle API + modele requis (3-arg streamChat) ──────────

    @Nested
    @DisplayName("guard clauses (cle API + modele)")
    class GuardClauses {

        /** ChatRequest valide (modele present) pour isoler le guard sur la cle. */
        private ChatRequest requestWithModel() {
            return new ChatRequest("sys", List.of(ChatMessage.user("hi")),
                    List.of(), "gpt-4o", 0.3, 100, null, "openai", "https://api.test/v1");
        }

        /** ChatRequest sans modele (null) pour declencher le guard "modele requis". */
        private ChatRequest requestWithoutModel() {
            return new ChatRequest("sys", List.of(ChatMessage.user("hi")),
                    List.of(), null, 0.3, 100, null, "openai", "https://api.test/v1");
        }

        private ChatEvent.Error onlyError(List<ChatEvent> events) {
            return (ChatEvent.Error) events.stream()
                    .filter(e -> e instanceof ChatEvent.Error)
                    .findFirst().orElseThrow();
        }

        @Test
        @DisplayName("3-arg avec cle null → Error 'Aucune cle API' (plus de repli env)")
        void threeArg_nullApiKey_emitsApiKeyError() throws Exception {
            // La surcharge 3-arg utilise la cle passee telle quelle : null → Error,
            // sans retomber sur aiProperties.getOpenai().getApiKey().
            HttpClient httpClient = mock(HttpClient.class);
            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(requestWithModel(), events::add, null);

            ChatEvent.Error err = onlyError(events);
            assertTrue(err.message().contains("Aucune cle API"),
                    "message: " + err.message());
            assertTrue(err.message().contains("openai"),
                    "le provider doit apparaitre dans le message: " + err.message());
            // Court-circuit avant tout appel reseau.
            verify(httpClient, times(0)).send(any(), any());
        }

        @Test
        @DisplayName("3-arg avec cle blank → Error 'Aucune cle API'")
        void threeArg_blankApiKey_emitsApiKeyError() throws Exception {
            HttpClient httpClient = mock(HttpClient.class);
            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(requestWithModel(), events::add, "   ");

            assertTrue(onlyError(events).message().contains("Aucune cle API"));
            verify(httpClient, times(0)).send(any(), any());
        }

        @Test
        @DisplayName("modele null → Error 'Aucun modèle IA configuré' (plus de defaut env)")
        void nullModel_emitsModelError() throws Exception {
            // Cle valide pour passer le 1er guard ; le modele null doit court-circuiter
            // sans retomber sur aiProperties.getOpenai().getModel().
            HttpClient httpClient = mock(HttpClient.class);
            OpenAiChatProvider p = new OpenAiChatProvider(aiProperties, objectMapper,
                    mock(ApplicationEventPublisher.class), httpClient);

            List<ChatEvent> events = new ArrayList<>();
            p.streamChat(requestWithoutModel(), events::add, "sk-explicit-key");

            assertTrue(onlyError(events).message().contains("Aucun modèle IA configuré"),
                    "message: " + onlyError(events).message());
            verify(httpClient, times(0)).send(any(), any());
        }
    }
}
