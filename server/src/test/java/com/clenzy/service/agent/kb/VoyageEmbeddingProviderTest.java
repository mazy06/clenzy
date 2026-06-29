package com.clenzy.service.agent.kb;

import com.clenzy.service.agent.kb.EmbeddingProvider.EmbeddingTarget;
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

class VoyageEmbeddingProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private VoyageEmbeddingProvider provider;

    /** Cible nominale resolue depuis la config DB (cle/modele/baseUrl/dimension). */
    private static EmbeddingTarget target(String apiKey) {
        return new EmbeddingTarget(apiKey, "voyage-3-large", "https://api.voyageai.com", 1024);
    }

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        provider = new VoyageEmbeddingProvider(restTemplate);
    }

    @Test
    void name_isVoyage() {
        assertEquals("voyage", provider.name());
    }

    @Nested
    @DisplayName("Single embed shortcuts")
    class SingleEmbed {

        @Test
        void nullText_returnsZeroVector() {
            float[] v = provider.embed(null, target("k"));
            assertEquals(1024, v.length);
        }

        @Test
        void blankText_returnsZeroVector() {
            float[] v = provider.embed("   ", target("k"));
            assertEquals(1024, v.length);
        }

        @Test
        void emptyText_returnsZeroVector() {
            float[] v = provider.embed("", target("k"));
            assertEquals(1024, v.length);
        }
    }

    @Nested
    @DisplayName("Batch embed")
    class BatchEmbed {

        @Test
        void nullOrEmptyBatch_returnsEmpty_noHttp() {
            assertTrue(provider.embedBatch(null, target("k")).isEmpty());
            assertTrue(provider.embedBatch(List.of(), target("k")).isEmpty());
        }

        @Test
        void nullApiKey_throwsEmbeddingException() {
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("hello"), target(null)));
            assertTrue(ex.getMessage().toLowerCase().contains("cle")
                    || ex.getMessage().toLowerCase().contains("voyage"));
        }

        @Test
        void blankApiKey_throwsEmbeddingException() {
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("hello"), target("   ")));
            assertTrue(ex.getMessage().toLowerCase().contains("cle")
                    || ex.getMessage().toLowerCase().contains("voyage"));
        }

        @Test
        void parsesEmbeddingsFromResponse() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("Authorization", "Bearer k"))
                    .andRespond(withSuccess("""
                            {
                              "data": [
                                {"embedding": [0.1, 0.2, 0.3], "index": 0},
                                {"embedding": [0.4, 0.5, 0.6], "index": 1}
                              ]
                            }
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = provider.embedBatch(List.of("a", "b"), target("k"));
            assertEquals(2, result.size());
            assertEquals(0.1f, result.get(0)[0], 1e-6);
            assertEquals(0.6f, result.get(1)[2], 1e-6);
            mockServer.verify();
        }

        @Test
        void singleEmbed_returnsFirstFromBatch() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.99], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            float[] v = provider.embed("hello", target("k"));
            assertEquals(1, v.length);
            assertEquals(0.99f, v[0], 1e-6);
        }

        @Test
        void nullEmbeddingInResponse_replacedWithZeroVector() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": null, "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = provider.embedBatch(List.of("x"), target("k"));
            assertEquals(1, result.size());
            assertEquals(1024, result.get(0).length);
        }

        @Test
        void httpServerError_wrappedAsEmbeddingException() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withServerError());

            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("hello"), target("k")));
            assertTrue(ex.getMessage().toLowerCase().contains("voyage"));
        }

        @Test
        void emptyResponseBody_throwsEmbeddingException() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
            assertThrows(EmbeddingProvider.EmbeddingException.class,
                    () -> provider.embedBatch(List.of("a"), target("k")));
        }

        @Test
        void batchLargerThan128_splitsIntoMultipleRequests() {
            // BATCH_SIZE = 128 → with 130 texts we expect 2 calls (128 + 2)
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(128), MediaType.APPLICATION_JSON));
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(2), MediaType.APPLICATION_JSON));

            List<String> texts = IntStream.range(0, 130).mapToObj(i -> "t" + i).toList();
            List<float[]> result = provider.embedBatch(texts, target("k"));
            assertEquals(130, result.size());
            mockServer.verify();
        }
    }

    @Nested
    @DisplayName("Endpoint resolution from target.baseUrl")
    class EndpointResolution {

        @Test
        void baseUrlEndingInV1_appendsEmbeddingsOnly() {
            mockServer.expect(requestTo("https://proxy.example.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.5], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            EmbeddingTarget t = new EmbeddingTarget(
                    "k", "voyage-3-large", "https://proxy.example.com/v1", 1024);
            List<float[]> result = provider.embedBatch(List.of("a"), t);
            assertEquals(1, result.size());
            mockServer.verify();
        }

        @Test
        void baseUrlWithoutV1_appendsV1Embeddings() {
            mockServer.expect(requestTo("https://proxy.example.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.5], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            EmbeddingTarget t = new EmbeddingTarget(
                    "k", "voyage-3-large", "https://proxy.example.com", 1024);
            List<float[]> result = provider.embedBatch(List.of("a"), t);
            assertEquals(1, result.size());
            mockServer.verify();
        }
    }

    @Nested
    @DisplayName("Model fallback")
    class ModelFallback {

        @Test
        void blankModel_fallsBackToDefaultModelInRequestBody() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(jsonPath("$.model").value(VoyageEmbeddingProvider.DEFAULT_MODEL))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.1], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            EmbeddingTarget t = new EmbeddingTarget("k", "  ", "https://api.voyageai.com", 1024);
            provider.embedBatch(List.of("a"), t);
            mockServer.verify();
        }

        @Test
        void explicitModel_isUsedInRequestBody() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andExpect(jsonPath("$.model").value("voyage-3-lite"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.1], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            EmbeddingTarget t = new EmbeddingTarget(
                    "k", "voyage-3-lite", "https://api.voyageai.com", 1024);
            provider.embedBatch(List.of("a"), t);
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
