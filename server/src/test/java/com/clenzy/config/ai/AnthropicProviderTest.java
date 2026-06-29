package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AnthropicProviderTest {

    private AiProperties aiProperties;
    private ObjectMapper objectMapper;
    private AnthropicProvider provider;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getAnthropic().setApiKey("sk-ant-test");
        aiProperties.getAnthropic().setModel("claude-sonnet-4-20250514");
        objectMapper = new ObjectMapper();
        provider = new AnthropicProvider(aiProperties, objectMapper,
                org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class));
    }

    @Test
    void name_returnsAnthropic() {
        assertEquals("anthropic", provider.name());
    }

    @Nested
    @DisplayName("chat()")
    class Chat {

        @Test
        void validResponse_parsesCorrectly() {
            String responseJson = """
                {
                    "id": "msg_123",
                    "type": "message",
                    "role": "assistant",
                    "model": "claude-sonnet-4-20250514",
                    "content": [{"type": "text", "text": "Bonjour le monde!"}],
                    "stop_reason": "end_turn",
                    "usage": {
                        "input_tokens": 40,
                        "output_tokens": 15
                    }
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("Tu es un assistant.", "Dis bonjour", "claude-sonnet-4-test");
            AiResponse response = provider.chat(request);

            assertEquals("Bonjour le monde!", response.content());
            assertEquals(40, response.promptTokens());
            assertEquals(15, response.completionTokens());
            assertEquals(55, response.totalTokens()); // input + output
            assertEquals("claude-sonnet-4-20250514", response.model());
            assertEquals("end_turn", response.finishReason());
        }

        @Test
        void emptyContent_throwsException() {
            String responseJson = """
                {
                    "model": "claude-sonnet-4-20250514",
                    "content": [],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 20, "output_tokens": 0}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("test", "test", "claude-sonnet-4-test");
            AiProviderException ex = assertThrows(AiProviderException.class, () -> provider.chat(request));
            assertTrue(ex.getMessage().contains("Empty content"));
            assertEquals("anthropic", ex.getProvider());
        }

        @Test
        void nullContent_throwsException() {
            String responseJson = """
                {
                    "model": "claude-sonnet-4-20250514",
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 0, "output_tokens": 0}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("test", "test", "claude-sonnet-4-test");
            assertThrows(AiProviderException.class, () -> provider.chat(request));
        }

        @Test
        void nullUsage_returnsZeroTokens() {
            String responseJson = """
                {
                    "model": "claude-sonnet-4-20250514",
                    "content": [{"type": "text", "text": "ok"}],
                    "stop_reason": "end_turn"
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("test", "test", "claude-sonnet-4-test");
            AiResponse response = provider.chat(request);

            assertEquals(0, response.promptTokens());
            assertEquals(0, response.completionTokens());
            assertEquals(0, response.totalTokens());
        }

        @Test
        void customModel_usesRequestModel() {
            String responseJson = """
                {
                    "model": "claude-3-haiku-20240307",
                    "content": [{"type": "text", "text": "fast response"}],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 10, "output_tokens": 5}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("sys", "usr", "claude-3-haiku-20240307");
            AiResponse response = provider.chat(request);

            assertEquals("claude-3-haiku-20240307", response.model());
            assertEquals("fast response", response.content());
        }

        @Test
        void nullModel_throwsBeforeHttpCall() {
            // Le modèle vient TOUJOURS de la config (résolu par AiTargetResolver), jamais d'un défaut env.
            // Une requête sans modèle doit échouer immédiatement, AVANT tout appel HTTP.
            RestClient mockClient = mock(RestClient.class);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.of("test", "test"); // model == null
            AiProviderException ex = assertThrows(AiProviderException.class, () -> provider.chat(request));
            assertTrue(ex.getMessage().contains("Aucun modèle résolu"));
            assertEquals("anthropic", ex.getProvider());
            verifyNoInteractions(mockClient);
        }

        @Test
        void longContent_parsesCompletely() {
            String longText = "A".repeat(5000);
            String responseJson = """
                {
                    "model": "claude-sonnet-4-20250514",
                    "content": [{"type": "text", "text": "%s"}],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 100, "output_tokens": 2000}
                }
                """.formatted(longText);

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withMaxTokens("sys", "usr", 4096).overrideModel("claude-sonnet-4-test");
            AiResponse response = provider.chat(request);

            assertEquals(5000, response.content().length());
        }

        @Test
        @SuppressWarnings("unchecked")
        void jsonMode_doesNotPrefillAssistant_conversationEndsWithUser() {
            // Non-régression : certains modèles Anthropic REJETTENT le prefill assistant
            // (400 « conversation must end with a user message »). jsonMode ne doit donc PAS ajouter de
            // tour assistant ; la sortie JSON repose sur le prompt + le parsing tolérant de l'appelant.
            String responseJson = """
                {
                    "model": "claude-sonnet-4-20250514",
                    "content": [{"type": "text", "text": "{\\"ok\\": true}"}],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 30, "output_tokens": 10}
                }
                """;

            RestClient mockClient = mock(RestClient.class);
            RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
            RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
            RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);
            when(mockClient.post()).thenReturn(uriSpec);
            when(uriSpec.uri(anyString())).thenReturn(bodySpec);
            when(bodySpec.contentType(any())).thenReturn(bodySpec);
            ArgumentCaptor<Object> bodyCaptor = ArgumentCaptor.forClass(Object.class);
            when(bodySpec.body(bodyCaptor.capture())).thenReturn(bodySpec);
            when(bodySpec.retrieve()).thenReturn(responseSpec);
            when(responseSpec.body(eq(String.class))).thenReturn(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.jsonWithMaxTokens("sys", "génère du JSON", 4096)
                    .overrideModel("claude-sonnet-4-test");
            AiResponse response = provider.chat(request);

            // La conversation se termine par un UNIQUE message user (aucun prefill assistant).
            Map<String, Object> body = (Map<String, Object>) bodyCaptor.getValue();
            List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
            assertEquals(1, messages.size());
            assertEquals("user", messages.get(0).get("role"));

            // Le contenu est renvoyé tel quel (pas de re-préfixage).
            assertEquals("{\"ok\": true}", response.content());
        }
    }

    // ─── Helper ──────────────────────────────────────────────────────────

    private RestClient createMockClient(String responseBody) {
        RestClient mockClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(mockClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(eq(String.class))).thenReturn(responseBody);

        return mockClient;
    }
}
