package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class OpenAIEmbeddingProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private OpenAIEmbeddingProvider provider;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        provider = new OpenAIEmbeddingProvider(restTemplate);
    }

    private EmbeddingProvider.EmbeddingTarget target(String key) {
        return new EmbeddingProvider.EmbeddingTarget(key, "text-embedding-3-large", "https://api.openai.com", 1024);
    }

    @Test
    void name_isOpenai() {
        assertEquals("openai", provider.name());
    }

    @Nested
    @DisplayName("Single embed shortcuts")
    class SingleEmbed {

        @Test
        void nullInput_returnsZeroVector_noHttp() {
            float[] v = provider.embed(null, target("sk-x"));
            assertEquals(1024, v.length);
            for (float f : v) assertEquals(0f, f);
        }

        @Test
        void blankInput_returnsZeroVector_noHttp() {
            float[] v = provider.embed("   ", target("sk-x"));
            assertEquals(1024, v.length);
        }

        @Test
        void zeroVectorSize_matchesTargetDimensions() {
            EmbeddingProvider.EmbeddingTarget t = new EmbeddingProvider.EmbeddingTarget(
                    "sk-x", "text-embedding-3-large", "https://api.openai.com", 512);
            float[] v = provider.embed(null, t);
            assertEquals(512, v.length);
        }
    }

    @Nested
    @DisplayName("Batch embed")
    class BatchEmbed {

        @Test
        void nullOrEmptyTexts_returnsEmptyList_noHttp() {
            assertTrue(provider.embedBatch(null, target("sk-x")).isEmpty());
            assertTrue(provider.embedBatch(List.of(), target("sk-x")).isEmpty());
        }

        @Test
        void noApiKey_throwsWithExplicitMessage() {
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("hello"), target("")));
            assertTrue(ex.getMessage().toLowerCase().contains("openai"));
            assertTrue(ex.getMessage().toLowerCase().contains("cle api"));
        }

        @Test
        void parsesEmbeddingsFromResponse() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("Authorization", "Bearer sk-x"))
                    .andRespond(withSuccess("""
                            {
                              "data": [
                                {"embedding": [0.1, 0.2, 0.3], "index": 0},
                                {"embedding": [0.4, 0.5, 0.6], "index": 1}
                              ]
                            }
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = provider.embedBatch(List.of("a", "b"), target("sk-x"));
            assertEquals(2, result.size());
            assertEquals(0.1f, result.get(0)[0], 1e-6);
            assertEquals(0.6f, result.get(1)[2], 1e-6);
        }

        @Test
        void sendsDimensionsInRequestBody() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(jsonPath("$.dimensions").value(1024))
                    .andExpect(jsonPath("$.model").value("text-embedding-3-large"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.1], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            provider.embedBatch(List.of("a"),
                    new EmbeddingProvider.EmbeddingTarget("sk-x", "text-embedding-3-large", "https://api.openai.com", 1024));
            mockServer.verify();
        }

        @Test
        void singleEmbed_returnsFirstFromBatch() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.7, 0.8], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            float[] v = provider.embed("hello", target("sk-x"));
            assertEquals(2, v.length);
            assertEquals(0.7f, v[0], 1e-6);
        }

        @Test
        void nullEmbeddingInResponse_replacedWithZeroVector() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": null, "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = provider.embedBatch(List.of("x"), target("sk-x"));
            assertEquals(1, result.size());
            assertEquals(1024, result.get(0).length);
        }

        @Test
        void httpServerError_wrappedAsEmbeddingException() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withServerError());

            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("hello"), target("sk-x")));
            assertTrue(ex.getMessage().toLowerCase().contains("openai"));
        }

        @Test
        void emptyResponseBody_throwsEmbeddingException() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("a"), target("sk-x")));
            assertTrue(ex.getMessage().toLowerCase().contains("openai"));
        }

        @Test
        void batchLargerThan96_splitsIntoMultipleRequests() {
            // BATCH_SIZE = 96 → with 100 texts we should see 2 HTTP calls
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(96), MediaType.APPLICATION_JSON));
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(4), MediaType.APPLICATION_JSON));

            List<String> texts = IntStream.range(0, 100)
                    .mapToObj(i -> "t" + i)
                    .toList();
            List<float[]> result = provider.embedBatch(texts, target("sk-x"));
            assertEquals(100, result.size());
            mockServer.verify();
        }
    }

    @Nested
    @DisplayName("Endpoint normalization")
    class EndpointNormalization {

        @Test
        void baseUrlEndingInV1_appendsEmbeddingsOnly() {
            mockServer.expect(requestTo("https://proxy.example.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.1], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            provider.embedBatch(List.of("a"),
                    new EmbeddingProvider.EmbeddingTarget("sk-x", "text-embedding-3-large", "https://proxy.example.com/v1", 1024));
            mockServer.verify();
        }

        @Test
        void baseUrlWithoutV1_appendsV1Embeddings() {
            mockServer.expect(requestTo("https://proxy.example.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.1], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            provider.embedBatch(List.of("a"),
                    new EmbeddingProvider.EmbeddingTarget("sk-x", "text-embedding-3-large", "https://proxy.example.com", 1024));
            mockServer.verify();
        }
    }

    private static String generateOkResponse(int count) {
        StringBuilder sb = new StringBuilder("{\"data\":[");
        for (int i = 0; i < count; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"embedding\":[0.1],\"index\":").append(i).append('}');
        }
        sb.append("]}");
        return sb.toString();
    }
}
