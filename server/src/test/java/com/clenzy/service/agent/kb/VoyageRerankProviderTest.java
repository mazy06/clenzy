package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import org.springframework.http.HttpMethod;

class VoyageRerankProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @Test
    void rerank_parsesIndices_inReorderedSequence() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "sk-voyage", "rerank-2-lite", "https://api.voyageai.com");

        mockServer.expect(requestTo("https://api.voyageai.com/v1/rerank"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"index": 2, "relevance_score": 0.95},
                            {"index": 0, "relevance_score": 0.81},
                            {"index": 1, "relevance_score": 0.42}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<Integer> indices = provider.rerank("q", List.of("a", "b", "c"), 3);
        assertEquals(List.of(2, 0, 1), indices);
    }

    @Test
    void noApiKey_throwsWithExplicitMessage() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "", "rerank-2-lite", "https://api.voyageai.com");
        assertFalse(provider.isAvailable());
        RerankProvider.RerankException ex = assertThrows(RerankProvider.RerankException.class,
                () -> provider.rerank("q", List.of("a"), 1));
        assertTrue(ex.getMessage().toLowerCase().contains("voyage_api_key"));
    }

    @Test
    void emptyDocs_returnsEmptyWithoutHttp() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "sk-voyage", "rerank-2-lite", "https://api.voyageai.com");
        assertTrue(provider.rerank("q", null, 5).isEmpty());
        assertTrue(provider.rerank("q", List.of(), 5).isEmpty());
        // Aucune requete HTTP envoyee
    }

    @Test
    void httpFailure_wrappedAsRerankException() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "sk-voyage", "rerank-2-lite", "https://api.voyageai.com");

        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        assertThrows(RerankProvider.RerankException.class,
                () -> provider.rerank("q", List.of("a", "b"), 2));
    }

    @Test
    void invalidIndex_filteredOut() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "sk-voyage", "rerank-2-lite", "https://api.voyageai.com");

        // L'API renvoie un index hors limites — on doit le skip silencieusement
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"index": 0, "relevance_score": 0.9},
                            {"index": 99, "relevance_score": 0.7}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<Integer> indices = provider.rerank("q", List.of("a", "b"), 5);
        assertEquals(List.of(0), indices, "Index 99 hors limites doit etre filtre");
    }

    @Test
    void name_returnsVoyage() {
        VoyageRerankProvider provider = new VoyageRerankProvider(
                restTemplate, "k", "m", "url");
        assertEquals("voyage", provider.name());
    }
}
