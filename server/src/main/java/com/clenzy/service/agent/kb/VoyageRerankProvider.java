package com.clenzy.service.agent.kb;

import com.clenzy.model.AiFeature;
import com.clenzy.service.PlatformAiConfigService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Re-ranking via Voyage AI (https://docs.voyageai.com/docs/reranker).
 *
 * <p>Modele configurable ({@code clenzy.ai.rerank.voyage.model}, defaut
 * {@code rerank-2-lite} — ~$0.05/1M tokens, latence ~150ms).</p>
 *
 * <p>Endpoint : {@code POST {baseUrl}/v1/rerank}.</p>
 *
 * <p><b>Credentials (2 sources, dans l'ordre)</b> :
 * <ol>
 *   <li>Cle dediee {@code clenzy.ai.rerank.voyage.api-key} (+ base-url optionnelle) —
 *       permet de garder le rerank Voyage meme quand les embeddings sont chez un
 *       autre provider (OpenAI…) ;</li>
 *   <li>Sinon, reutilise la cle + baseUrl du modele assigne a la feature
 *       {@link AiFeature#EMBEDDINGS} <i>lorsque c'est un modele Voyage</i>.</li>
 * </ol>
 * Si aucune source n'est exploitable, {@link #isAvailable()} retourne false et le
 * {@link RerankService} bascule sur {@link NoOpRerankProvider}.</p>
 */
@Component
public class VoyageRerankProvider implements RerankProvider {

    private static final Logger log = LoggerFactory.getLogger(VoyageRerankProvider.class);
    private static final String DEFAULT_MODEL = "rerank-2-lite";
    private static final String DEFAULT_BASE_URL = "https://api.voyageai.com";

    private final RestTemplate restTemplate;
    private final PlatformAiConfigService platformAiConfigService;
    private final String dedicatedApiKey;
    private final String dedicatedBaseUrl;
    private final String model;

    public VoyageRerankProvider(RestTemplate restTemplate,
                                  PlatformAiConfigService platformAiConfigService,
                                  @org.springframework.beans.factory.annotation.Value(
                                          "${clenzy.ai.rerank.voyage.api-key:}") String dedicatedApiKey,
                                  @org.springframework.beans.factory.annotation.Value(
                                          "${clenzy.ai.rerank.voyage.base-url:}") String dedicatedBaseUrl,
                                  @org.springframework.beans.factory.annotation.Value(
                                          "${clenzy.ai.rerank.voyage.model:rerank-2-lite}") String model) {
        this.restTemplate = restTemplate;
        this.platformAiConfigService = platformAiConfigService;
        this.dedicatedApiKey = dedicatedApiKey;
        this.dedicatedBaseUrl = dedicatedBaseUrl;
        this.model = (model == null || model.isBlank()) ? DEFAULT_MODEL : model;
    }

    @Override
    public String name() {
        return "voyage";
    }

    /** Credentials Voyage : cle dediee rerank, sinon celles du modele EMBEDDINGS Voyage. */
    private record VoyageCreds(String apiKey, String baseUrl) {}

    private VoyageCreds resolveCreds() {
        if (dedicatedApiKey != null && !dedicatedApiKey.isBlank()) {
            return new VoyageCreds(dedicatedApiKey,
                    (dedicatedBaseUrl != null && !dedicatedBaseUrl.isBlank())
                            ? dedicatedBaseUrl : DEFAULT_BASE_URL);
        }
        return platformAiConfigService.getActiveModelForFeature(AiFeature.EMBEDDINGS.name())
                .filter(m -> "voyage".equalsIgnoreCase(m.getProvider()))
                .filter(m -> m.getApiKey() != null && !m.getApiKey().isBlank())
                .map(m -> new VoyageCreds(
                        m.getApiKey(),
                        (m.getBaseUrl() != null && !m.getBaseUrl().isBlank()) ? m.getBaseUrl() : DEFAULT_BASE_URL))
                .orElse(null);
    }

    @Override
    public boolean isAvailable() {
        return resolveCreds() != null;
    }

    @Override
    public List<Integer> rerank(String query, List<String> documents, int topK) {
        if (documents == null || documents.isEmpty()) return List.of();
        VoyageCreds creds = resolveCreds();
        if (creds == null) {
            throw new RerankException(
                    "Rerank Voyage indisponible : aucun modele d'embeddings Voyage configure (Parametres > IA)");
        }
        int effectiveK = Math.min(topK, documents.size());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("query", query);
        body.put("documents", documents);
        body.put("model", model);
        body.put("top_k", effectiveK);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(creds.apiKey());

        try {
            // Le rerank est toujours sur le chemin d'un tour de chat : retry court.
            RerankResponse response = AiHttpRetry.execute("Voyage rerank",
                    AiHttpRetry.QUERY_ATTEMPTS,
                    () -> restTemplate.postForObject(
                            rerankEndpoint(creds.baseUrl()),
                            new HttpEntity<>(body, headers),
                            RerankResponse.class));
            if (response == null || response.data == null) {
                throw new RerankException("Voyage rerank : reponse vide");
            }
            List<Integer> out = new ArrayList<>(response.data.size());
            for (RerankItem item : response.data) {
                if (item.index != null && item.index >= 0 && item.index < documents.size()) {
                    out.add(item.index);
                }
            }
            return out;
        } catch (RerankException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Voyage rerank API failed (docs={}, k={}) : {}",
                    documents.size(), effectiveK, e.getMessage());
            throw new RerankException("Voyage rerank : " + e.getMessage(), e);
        }
    }

    /** baseUrl peut finir par "/v1" (convention catalogue chat) ou non — on normalise. */
    private static String rerankEndpoint(String baseUrl) {
        return baseUrl.endsWith("/v1") ? baseUrl + "/rerank" : baseUrl + "/v1/rerank";
    }

    // ─── DTOs Voyage AI rerank ──────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RerankResponse {
        public List<RerankItem> data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RerankItem {
        public Integer index;
        public Double relevance_score;
    }
}
