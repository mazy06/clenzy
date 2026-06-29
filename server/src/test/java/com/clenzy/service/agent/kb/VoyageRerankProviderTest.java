package com.clenzy.service.agent.kb;

import com.clenzy.model.AiFeature;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.service.PlatformAiConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class VoyageRerankProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private PlatformAiConfigService platformAiConfigService;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        platformAiConfigService = mock(PlatformAiConfigService.class);
    }

    /** Mocke un modele EMBEDDINGS Voyage exploitable (provider=voyage, cle non-blank). */
    private void withVoyageEmbeddingsModel(String apiKey, String baseUrl) {
        PlatformAiModel model = mock(PlatformAiModel.class);
        when(model.getProvider()).thenReturn("voyage");
        when(model.getApiKey()).thenReturn(apiKey);
        when(model.getBaseUrl()).thenReturn(baseUrl);
        when(platformAiConfigService.getActiveModelForFeature(AiFeature.EMBEDDINGS.name()))
                .thenReturn(Optional.of(model));
    }

    private VoyageRerankProvider newProvider() {
        return new VoyageRerankProvider(restTemplate, platformAiConfigService);
    }

    @Test
    void rerank_parsesIndices_inReorderedSequence() {
        withVoyageEmbeddingsModel("vk", "https://api.voyageai.com");
        VoyageRerankProvider provider = newProvider();

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
        mockServer.verify();
    }

    @Test
    void noVoyageModel_isUnavailable_andRerankThrows() {
        // Aucun modele EMBEDDINGS configure → indisponible
        when(platformAiConfigService.getActiveModelForFeature(AiFeature.EMBEDDINGS.name()))
                .thenReturn(Optional.empty());
        VoyageRerankProvider provider = newProvider();

        assertFalse(provider.isAvailable());
        RerankProvider.RerankException ex = assertThrows(RerankProvider.RerankException.class,
                () -> provider.rerank("q", List.of("a"), 1));
        assertTrue(ex.getMessage().toLowerCase().contains("voyage"));
        // Aucune requete HTTP envoyee
    }

    @Test
    void nonVoyageEmbeddingsModel_isUnavailable() {
        // Le modele EMBEDDINGS existe mais n'est pas un Voyage → indisponible
        PlatformAiModel openai = mock(PlatformAiModel.class);
        when(openai.getProvider()).thenReturn("openai");
        when(platformAiConfigService.getActiveModelForFeature(AiFeature.EMBEDDINGS.name()))
                .thenReturn(Optional.of(openai));
        VoyageRerankProvider provider = newProvider();

        assertFalse(provider.isAvailable());
        assertThrows(RerankProvider.RerankException.class,
                () -> provider.rerank("q", List.of("a"), 1));
    }

    @Test
    void emptyDocs_returnsEmptyWithoutHttp() {
        withVoyageEmbeddingsModel("vk", "https://api.voyageai.com");
        VoyageRerankProvider provider = newProvider();

        assertTrue(provider.rerank("q", null, 5).isEmpty());
        assertTrue(provider.rerank("q", List.of(), 5).isEmpty());
        // Aucune requete HTTP envoyee
    }

    @Test
    void httpFailure_wrappedAsRerankException() {
        withVoyageEmbeddingsModel("vk", "https://api.voyageai.com");
        VoyageRerankProvider provider = newProvider();

        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        assertThrows(RerankProvider.RerankException.class,
                () -> provider.rerank("q", List.of("a", "b"), 2));
    }

    @Test
    void invalidIndex_filteredOut() {
        withVoyageEmbeddingsModel("vk", "https://api.voyageai.com");
        VoyageRerankProvider provider = newProvider();

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
    void baseUrlEndingInV1_appendsRerankWithoutDuplicatingV1() {
        // baseUrl finissant par /v1 → endpoint = {baseUrl}/rerank (pas /v1/v1/rerank)
        withVoyageEmbeddingsModel("vk", "https://api.voyageai.com/v1");
        VoyageRerankProvider provider = newProvider();

        mockServer.expect(requestTo("https://api.voyageai.com/v1/rerank"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"data": [{"index": 0, "relevance_score": 0.9}]}
                        """, MediaType.APPLICATION_JSON));

        List<Integer> indices = provider.rerank("q", List.of("a"), 1);
        assertEquals(List.of(0), indices);
        mockServer.verify();
    }

    @Test
    void name_returnsVoyage() {
        // name() ne depend pas de la config
        VoyageRerankProvider provider = newProvider();
        assertEquals("voyage", provider.name());
    }
}
