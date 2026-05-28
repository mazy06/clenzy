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
 * Provider OpenAI {@code text-embedding-3-large} avec param {@code dimensions=1024}
 * pour matcher la table {@code kb_chunk.embedding}.
 *
 * <p><b>Modele defaut : {@code text-embedding-3-large}</b> (jusqu'a 3072d,
 * tronque a 1024 via MRL). Qualite superieure a {@code small} (-3.5% MRR
 * benchmark MTEB), surcout ~6.5x (~$0.13/1M vs $0.02/1M) — mais absolument
 * negligeable a notre volume.</p>
 *
 * <p>Override possible via {@code clenzy.ai.embeddings.openai.model} si on
 * voulait revenir a {@code text-embedding-3-small} pour reduire les couts
 * sur de gros volumes (>10M tokens/mois).</p>
 *
 * <p>Endpoint : {@code POST https://api.openai.com/v1/embeddings}.</p>
 *
 * <p>Activation : {@code clenzy.ai.embeddings.provider=openai}. La cle est
 * lue depuis {@code clenzy.ai.embeddings.openai.api-key} (peut etre la meme
 * que celle du chat ou differente).</p>
 */
@Component
public class OpenAIEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAIEmbeddingProvider.class);
    /** Meilleur modele OpenAI 2026 (qualite > cout justifie). */
    private static final String DEFAULT_MODEL = "text-embedding-3-large";
    private static final int BATCH_SIZE = 96; // OpenAI limit ~2048 inputs mais on reste prudent

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final int targetDimensions;

    public OpenAIEmbeddingProvider(RestTemplate restTemplate,
                                     ObjectMapper objectMapper,
                                     @Value("${clenzy.ai.embeddings.openai.api-key:}") String apiKey,
                                     @Value("${clenzy.ai.embeddings.openai.model:" + DEFAULT_MODEL + "}") String model,
                                     @Value("${clenzy.ai.embeddings.openai.base-url:https://api.openai.com}") String baseUrl,
                                     @Value("${clenzy.ai.embeddings.openai.dimensions:1024}") int targetDimensions) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
        this.targetDimensions = targetDimensions;
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public int dimensions() {
        return targetDimensions;
    }

    @Override
    public float[] embed(String text) {
        if (text == null || text.isBlank()) return new float[dimensions()];
        List<float[]> result = embedBatch(List.of(text));
        return result.isEmpty() ? new float[dimensions()] : result.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (apiKey == null || apiKey.isBlank()) {
            throw new EmbeddingException(
                    "OPENAI_API_KEY non configure pour embeddings "
                            + "(property clenzy.ai.embeddings.openai.api-key)");
        }

        List<float[]> all = new ArrayList<>(texts.size());
        for (int i = 0; i < texts.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, texts.size());
            all.addAll(callApi(texts.subList(i, end)));
        }
        return all;
    }

    private List<float[]> callApi(List<String> batch) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("input", batch);
        body.put("model", model);
        // text-embedding-3-{small,large} supportent la troncature MRL via "dimensions"
        body.put("dimensions", targetDimensions);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            OpenAIResponse response = restTemplate.postForObject(
                    baseUrl + "/v1/embeddings",
                    new HttpEntity<>(body, headers),
                    OpenAIResponse.class);
            if (response == null || response.data == null) {
                throw new EmbeddingException("OpenAI embeddings : reponse vide");
            }
            List<float[]> out = new ArrayList<>(response.data.size());
            for (OpenAIData d : response.data) {
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
            log.warn("OpenAI embeddings API failed (batch size={}) : {}",
                    batch.size(), e.getMessage());
            throw new EmbeddingException("OpenAI embeddings : " + e.getMessage(), e);
        }
    }

    // ─── DTOs OpenAI ────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OpenAIResponse {
        public List<OpenAIData> data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OpenAIData {
        public List<Float> embedding;
        public Integer index;
    }
}
