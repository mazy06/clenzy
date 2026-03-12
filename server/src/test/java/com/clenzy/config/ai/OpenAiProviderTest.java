package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OpenAiProviderTest {

    private AiProperties aiProperties;
    private ObjectMapper objectMapper;
    private OpenAiProvider provider;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getOpenai().setApiKey("sk-test");
        aiProperties.getOpenai().setModel("gpt-4o");
        objectMapper = new ObjectMapper();
        provider = new OpenAiProvider(aiProperties, objectMapper);
    }

    @Test
    void name_returnsOpenai() {
        assertEquals("openai", provider.name());
    }

    @Nested
    @DisplayName("chat()")
    class Chat {

        @Test
        void validResponse_parsesCorrectly() {
            // Mock RestClient
            String responseJson = """
                {
                    "id": "chatcmpl-123",
                    "model": "gpt-4o-2024-08-06",
                    "choices": [{
                        "index": 0,
                        "message": {"role": "assistant", "content": "Hello, world!"},
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": 50,
                        "completion_tokens": 10,
                        "total_tokens": 60
                    }
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.of("You are helpful.", "Say hello");
            AiResponse response = provider.chat(request);

            assertEquals("Hello, world!", response.content());
            assertEquals(50, response.promptTokens());
            assertEquals(10, response.completionTokens());
            assertEquals(60, response.totalTokens());
            assertEquals("gpt-4o-2024-08-06", response.model());
            assertEquals("stop", response.finishReason());
        }

        @Test
        void jsonMode_includesResponseFormat() {
            String responseJson = """
                {
                    "model": "gpt-4o",
                    "choices": [{
                        "message": {"content": "{\\"key\\": \\"value\\"}"},
                        "finish_reason": "stop"
                    }],
                    "usage": {"prompt_tokens": 20, "completion_tokens": 5, "total_tokens": 25}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.json("Extract JSON.", "Some data");
            AiResponse response = provider.chat(request);

            assertEquals("{\"key\": \"value\"}", response.content());
        }

        @Test
        void emptyChoices_throwsException() {
            String responseJson = """
                {
                    "model": "gpt-4o",
                    "choices": [],
                    "usage": {"prompt_tokens": 20, "completion_tokens": 0, "total_tokens": 20}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.of("test", "test");
            AiProviderException ex = assertThrows(AiProviderException.class, () -> provider.chat(request));
            assertTrue(ex.getMessage().contains("Empty choices"));
            assertEquals("openai", ex.getProvider());
        }

        @Test
        void nullChoices_throwsException() {
            String responseJson = """
                {"model": "gpt-4o", "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.of("test", "test");
            assertThrows(AiProviderException.class, () -> provider.chat(request));
        }

        @Test
        void nullUsage_returnsZeroTokens() {
            String responseJson = """
                {
                    "model": "gpt-4o",
                    "choices": [{
                        "message": {"content": "ok"},
                        "finish_reason": "stop"
                    }]
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.of("test", "test");
            AiResponse response = provider.chat(request);

            assertEquals(0, response.promptTokens());
            assertEquals(0, response.completionTokens());
            assertEquals(0, response.totalTokens());
        }

        @Test
        void customModel_usesRequestModel() {
            String responseJson = """
                {
                    "model": "gpt-4o-mini",
                    "choices": [{
                        "message": {"content": "hi"},
                        "finish_reason": "stop"
                    }],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 2, "total_tokens": 12}
                }
                """;

            RestClient mockClient = createMockClient(responseJson);
            provider.setRestClient(mockClient);

            AiRequest request = AiRequest.withModel("sys", "usr", "gpt-4o-mini");
            AiResponse response = provider.chat(request);

            assertEquals("gpt-4o-mini", response.model());
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
        // body(Object) returns RequestBodySpec — use lenient for overloaded methods
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(eq(String.class))).thenReturn(responseBody);

        return mockClient;
    }
}
