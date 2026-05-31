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

class OpenAIEmbeddingProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper om;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        om = new ObjectMapper();
    }

    private OpenAIEmbeddingProvider providerWithKey(String key) {
        return new OpenAIEmbeddingProvider(restTemplate, om,
                key, "text-embedding-3-large", "https://api.openai.com", 1024);
    }

    @Test
    void name_isOpenai() {
        assertEquals("openai", providerWithKey("sk-x").name());
    }

    @Test
    void dimensions_returnsConfigured() {
        OpenAIEmbeddingProvider p = new OpenAIEmbeddingProvider(restTemplate, om,
                "sk-x", "text-embedding-3-large", "https://api.openai.com", 512);
        assertEquals(512, p.dimensions());
    }

    @Nested
    @DisplayName("Single embed shortcuts")
    class SingleEmbed {

        @Test
        void nullInput_returnsZeroVector_noHttp() {
            float[] v = providerWithKey("sk-x").embed(null);
            assertEquals(1024, v.length);
            for (float f : v) assertEquals(0f, f);
        }

        @Test
        void blankInput_returnsZeroVector_noHttp() {
            float[] v = providerWithKey("sk-x").embed("   ");
            assertEquals(1024, v.length);
        }
    }

    @Nested
    @DisplayName("Batch embed")
    class BatchEmbed {

        @Test
        void nullOrEmptyTexts_returnsEmptyList_noHttp() {
            OpenAIEmbeddingProvider p = providerWithKey("sk-x");
            assertTrue(p.embedBatch(null).isEmpty());
            assertTrue(p.embedBatch(List.of()).isEmpty());
        }

        @Test
        void noApiKey_throwsWithExplicitMessage() {
            OpenAIEmbeddingProvider p = providerWithKey("");
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> p.embedBatch(List.of("hello")));
            assertTrue(ex.getMessage().toLowerCase().contains("openai_api_key")
                    || ex.getMessage().toLowerCase().contains("clenzy.ai.embeddings"));
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

            List<float[]> result = providerWithKey("sk-x").embedBatch(List.of("a", "b"));
            assertEquals(2, result.size());
            assertEquals(0.1f, result.get(0)[0], 1e-6);
            assertEquals(0.6f, result.get(1)[2], 1e-6);
        }

        @Test
        void singleEmbed_returnsFirstFromBatch() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": [0.7, 0.8], "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            float[] v = providerWithKey("sk-x").embed("hello");
            assertEquals(2, v.length);
            assertEquals(0.7f, v[0], 1e-6);
        }

        @Test
        void nullEmbeddingInResponse_replacedWithZeroVector() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("""
                            {"data": [{"embedding": null, "index": 0}]}
                            """, MediaType.APPLICATION_JSON));

            List<float[]> result = providerWithKey("sk-x").embedBatch(List.of("x"));
            assertEquals(1, result.size());
            assertEquals(1024, result.get(0).length);
        }

        @Test
        void httpServerError_wrappedAsEmbeddingException() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withServerError());

            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> providerWithKey("sk-x").embedBatch(List.of("hello")));
            assertTrue(ex.getMessage().toLowerCase().contains("openai"));
        }

        @Test
        void emptyResponseBody_throwsEmbeddingException() {
            mockServer.expect(requestTo("https://api.openai.com/v1/embeddings"))
                    .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
            EmbeddingProvider.EmbeddingException ex = assertThrows(
                    EmbeddingProvider.EmbeddingException.class,
                    () -> providerWithKey("sk-x").embedBatch(List.of("a")));
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
            List<float[]> result = providerWithKey("sk-x").embedBatch(texts);
            assertEquals(100, result.size());
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
