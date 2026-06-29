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
 * <p>Modele : {@code rerank-2-lite} (~$0.05/1M tokens, latence ~150ms). Bon compromis
 * qualite/cout pour la phase de re-ranking apres une recherche par embeddings.</p>
 *
 * <p>Endpoint : {@code POST {baseUrl}/v1/rerank}.</p>
 *
 * <p><b>Credentials = config DB (source unique)</b> : le rerank Voyage reutilise la cle + baseUrl
 * du modele assigne a la feature {@link AiFeature#EMBEDDINGS} <i>lorsque ce modele est un modele
 * Voyage</i> (meme compte Voyage AI). Plus aucune variable d'environnement. Si le modele EMBEDDINGS
 * n'est pas un Voyage exploitable, {@link #isAvailable()} retourne false et le {@link RerankService}
 * bascule sur {@link NoOpRerankProvider}.</p>
 */
@Component
public class VoyageRerankProvider implements RerankProvider {

    private static final Logger log = LoggerFactory.getLogger(VoyageRerankProvider.class);
    private static final String MODEL = "rerank-2-lite";
    private static final String DEFAULT_BASE_URL = "https://api.voyageai.com";

    private final RestTemplate restTemplate;
    private final PlatformAiConfigService platformAiConfigService;

    public VoyageRerankProvider(RestTemplate restTemplate,
                                  PlatformAiConfigService platformAiConfigService) {
        this.restTemplate = restTemplate;
        this.platformAiConfigService = platformAiConfigService;
    }

    @Override
    public String name() {
        return "voyage";
    }

    /** Credentials Voyage resolus depuis le modele EMBEDDINGS (si c'est bien un Voyage). */
    private record VoyageCreds(String apiKey, String baseUrl) {}

    private VoyageCreds resolveCreds() {
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
        body.put("model", MODEL);
        body.put("top_k", effectiveK);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(creds.apiKey());

        try {
            RerankResponse response = restTemplate.postForObject(
                    rerankEndpoint(creds.baseUrl()),
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
