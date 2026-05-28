package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Provider Voyage AI (https://docs.voyageai.com/).
 *
 * <p><b>Modele defaut : {@code voyage-3-large}</b> (1024d, ~$0.18/1M tokens).
 * Recommande par Anthropic pour les embeddings dans un contexte Claude.
 * <i>Choix design</i> : la qualite de rappel RAG est critique pour
 * l'anti-hallucination, et le surcout est negligeable a notre volume
 * (ingestion doc + ~10-100 tokens/query) — quelques euros/mois.</p>
 *
 * <p>Override possible via {@code clenzy.ai.embeddings.voyage.model} si on
 * voulait revenir a {@code voyage-3-lite} (1024d, ~$0.02/1M, qualite plus
 * faible) ou tester {@code voyage-3} (1024d, ~$0.06/1M, milieu).</p>
 *
 * <p>Endpoint : {@code POST /v1/embeddings}. Body :
 * {@code {"input": ["..."], "model": "voyage-3-large", "input_type": "document"}}.
 * Reponse : {@code {"data": [{"embedding": [0.1, ...]}, ...], "usage": {...}}}.</p>
 *
 * <p>Activation : property {@code clenzy.ai.embeddings.provider=voyage} +
 * {@code clenzy.ai.embeddings.voyage.api-key=<key>}. Sans cle, le bean reste
 * declare mais throw a la premiere invocation — c'est intentionnel (fail-fast
 * vs degradation silencieuse).</p>
 */
@Component
public class VoyageEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(VoyageEmbeddingProvider.class);
    /** {@code voyage-3-large} : meilleur modele Voyage 1024d. Qualite > cout. */
    private static final String DEFAULT_MODEL = "voyage-3-large";
    private static final int BATCH_SIZE = 128;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String baseUrl;

    public VoyageEmbeddingProvider(RestTemplate restTemplate,
                                     ObjectMapper objectMapper,
                                     @Value("${clenzy.ai.embeddings.voyage.api-key:}") String apiKey,
                                     @Value("${clenzy.ai.embeddings.voyage.model:" + DEFAULT_MODEL + "}") String model,
                                     @Value("${clenzy.ai.embeddings.voyage.base-url:https://api.voyageai.com}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    @Override
    public String name() {
        return "voyage";
    }

    @Override
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            return new float[dimensions()];
        }
        List<float[]> result = embedBatch(List.of(text));
        return result.isEmpty() ? new float[dimensions()] : result.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (apiKey == null || apiKey.isBlank()) {
            throw new EmbeddingException(
                    "VOYAGE_API_KEY non configure (property clenzy.ai.embeddings.voyage.api-key)");
        }

        List<float[]> all = new ArrayList<>(texts.size());
        // L'API Voyage accepte jusqu'a ~128 inputs par requete — on sous-batch.
        for (int i = 0; i < texts.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, texts.size());
            List<String> batch = texts.subList(i, end);
            all.addAll(callApi(batch));
        }
        return all;
    }

    private List<float[]> callApi(List<String> batch) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("input", batch);
        body.put("model", model);
        body.put("input_type", "document");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            VoyageResponse response = restTemplate.postForObject(
                    baseUrl + "/v1/embeddings",
                    new HttpEntity<>(body, headers),
                    VoyageResponse.class);
            if (response == null || response.data == null) {
                throw new EmbeddingException("Voyage API : reponse vide");
            }
            List<float[]> out = new ArrayList<>(response.data.size());
            for (VoyageData d : response.data) {
                if (d.embedding == null) {
                    out.add(new float[dimensions()]);
                    continue;
                }
                float[] v = new float[d.embedding.size()];
                for (int i = 0; i < d.embedding.size(); i++) v[i] = d.embedding.get(i);
                out.add(v);
            }
            return out;
        } catch (Exception e) {
            log.warn("Voyage embeddings API failed (batch size={}) : {}",
                    batch.size(), e.getMessage());
            throw new EmbeddingException("Voyage embeddings : " + e.getMessage(), e);
        }
    }

    // ─── DTOs Voyage AI ─────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class VoyageResponse {
        public List<VoyageData> data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class VoyageData {
        public List<Float> embedding;
        public Integer index;
    }
}
