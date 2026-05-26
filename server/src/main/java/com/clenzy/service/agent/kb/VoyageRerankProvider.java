package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
 * <p>Modele par defaut : {@code rerank-2-lite} (~$0.05/1M tokens, latence
 * ~150ms). Bon compromis qualite/cout, recommande pour la phase de re-ranking
 * apres une recherche par embeddings.</p>
 *
 * <p>Endpoint : {@code POST /v1/rerank}. Body :
 * <pre>
 * {"query": "...", "documents": ["...", "..."],
 *  "model": "rerank-2-lite", "top_k": 5}
 * </pre>
 * Reponse :
 * <pre>
 * {"data": [{"index": 3, "relevance_score": 0.92}, ...]}
 * </pre>
 *
 * <p>Si la cle API manque, {@link #isAvailable()} retourne false et le bean
 * reste inactif (le {@link RerankService} bascule sur {@link NoOpRerankProvider}).</p>
 */
@Component
public class VoyageRerankProvider implements RerankProvider {

    private static final Logger log = LoggerFactory.getLogger(VoyageRerankProvider.class);
    private static final String DEFAULT_MODEL = "rerank-2-lite";

    private final RestTemplate restTemplate;
    private final String apiKey;
    private final String model;
    private final String baseUrl;

    public VoyageRerankProvider(RestTemplate restTemplate,
                                  @Value("${clenzy.ai.rerank.voyage.api-key:${clenzy.ai.embeddings.voyage.api-key:}}") String apiKey,
                                  @Value("${clenzy.ai.rerank.voyage.model:" + DEFAULT_MODEL + "}") String model,
                                  @Value("${clenzy.ai.rerank.voyage.base-url:https://api.voyageai.com}") String baseUrl) {
        this.restTemplate = restTemplate;
        // Reutilise la cle Voyage AI embeddings par defaut (meme compte)
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    @Override
    public String name() {
        return "voyage";
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public List<Integer> rerank(String query, List<String> documents, int topK) {
        if (documents == null || documents.isEmpty()) return List.of();
        if (!isAvailable()) {
            throw new RerankException("VOYAGE_API_KEY non configure pour le rerank");
        }
        int effectiveK = Math.min(topK, documents.size());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("query", query);
        body.put("documents", documents);
        body.put("model", model);
        body.put("top_k", effectiveK);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            RerankResponse response = restTemplate.postForObject(
                    baseUrl + "/v1/rerank",
                    new HttpEntity<>(body, headers),
                    RerankResponse.class);
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
