package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    private ObjectMapper om;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        om = new ObjectMapper();
    }

    private VoyageEmbeddingProvider providerWithKey(String key) {
        return new VoyageEmbeddingProvider(restTemplate, om, key,
                "voyage-3-large", "https://api.voyageai.com");
    }

    @Test
    void name_isVoyage() {
        assertEquals("voyage", providerWithKey("k").name());
    }

    @Test
    void dimensions_defaultsTo1024() {
        assertEquals(1024, providerWithKey("k").dimensions());
    }

    @Nested
    @DisplayName("Single embed shortcuts")
    class SingleEmbed {

        @Test
        void nullText_returnsZeroVector() {
            float[] v = providerWithKey("k").embed(null);
            assertEquals(1024, v.length);
        }

        @Test
        void blankText_returnsZeroVector() {
            float[] v = providerWithKey("k").embed("   ");
            assertEquals(1024, v.length);
        }
    }

    @Nested
    @DisplayName("Batch embed")
    class BatchEmbed {

        @Test
        void nullOrEmptyBatch_returnsEmpty_noHttp() {
            VoyageEmbeddingProvider p = providerWithKey("k");
            assertTrue(p.embedBatch(null).isEmpty());
            assertTrue(p.embedBatch(List.of()).isEmpty());
        }

        @Test
        void noApiKey_throwsEmbeddingException() {
            VoyageEmbeddingProvider p = providerWithKey("");
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> p.embedBatch(List.of("hello")));
            assertTrue(ex.getMessage().toLowerCase().contains("voyage_api_key")
                    || ex.getMessage().toLowerCase().contains("clenzy.ai.embeddings"));
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

            List<float[]> result = providerWithKey("k").embedBatch(List.of("a", "b"));
            assertEquals(2, result.size());
            assertEquals(0.1f, result.get(0)[0], 1e-6);
            assertEquals(0.6f, result.get(1)[2], 1e-6);
        }

        @Test
        void singleEmbed_returnsFirstFromBatch() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.99], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            float[] v = providerWithKey("k").embed("hello");
            assertEquals(1, v.length);
            assertEquals(0.99f, v[0], 1e-6);
        }

        @Test
        void nullEmbeddingInResponse_replacedWithZeroVector() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": null, "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = providerWithKey("k").embedBatch(List.of("x"));
            assertEquals(1, result.size());
            assertEquals(1024, result.get(0).length);
        }

        @Test
        void httpServerError_wrappedAsEmbeddingException() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withServerError());

            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> providerWithKey("k").embedBatch(List.of("hello")));
            assertTrue(ex.getMessage().toLowerCase().contains("voyage"));
        }

        @Test
        void emptyResponseBody_throwsEmbeddingException() {
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
            assertThrows(EmbeddingProvider.EmbeddingException.class,
                    () -> providerWithKey("k").embedBatch(List.of("a")));
        }

        @Test
        void batchLargerThan128_splitsIntoMultipleRequests() {
            // BATCH_SIZE = 128 → with 130 texts we expect 2 calls (128 + 2)
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(128), MediaType.APPLICATION_JSON));
            mockServer.expect(requestTo("https://api.voyageai.com/v1/embeddings"))
                    .andRespond(withSuccess(generateOkResponse(2), MediaType.APPLICATION_JSON));

            List<String> texts = IntStream.range(0, 130).mapToObj(i -> "t" + i).toList();
            List<float[]> result = providerWithKey("k").embedBatch(texts);
            assertEquals(130, result.size());
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
