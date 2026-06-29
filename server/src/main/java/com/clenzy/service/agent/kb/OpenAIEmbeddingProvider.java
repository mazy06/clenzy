package com.clenzy.service.agent.kb;

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
 * Provider OpenAI {@code text-embedding-3-*} avec param {@code dimensions} (troncature MRL)
 * pour matcher la table {@code kb_chunk.embedding} (1024d).
 *
 * <p><b>Modele defaut : {@code text-embedding-3-large}</b>, repli si le catalogue ne fixe
 * pas de {@code modelId}.</p>
 *
 * <p>Endpoint : {@code POST {baseUrl}/v1/embeddings}.</p>
 *
 * <p><b>Credential-stateless</b> : cle/modele/baseUrl/dimension viennent de la
 * {@link EmbeddingTarget} resolue par {@link EmbeddingService} depuis la config DB
 * (feature EMBEDDINGS) — plus aucune variable d'environnement.</p>
 */
@Component
public class OpenAIEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAIEmbeddingProvider.class);
    /** Meilleur modele OpenAI 2026. Repli si le catalogue ne fixe rien. */
    static final String DEFAULT_MODEL = "text-embedding-3-large";
    static final String DEFAULT_BASE_URL = "https://api.openai.com";
    private static final int BATCH_SIZE = 96; // OpenAI limit ~2048 inputs mais on reste prudent

    private final RestTemplate restTemplate;

    public OpenAIEmbeddingProvider(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public float[] embed(String text, EmbeddingTarget target) {
        if (text == null || text.isBlank()) return new float[target.dimensions()];
        List<float[]> result = embedBatch(List.of(text), target);
        return result.isEmpty() ? new float[target.dimensions()] : result.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts, EmbeddingTarget target) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (target == null || target.apiKey() == null || target.apiKey().isBlank()) {
            throw new EmbeddingException(
                    "OpenAI : cle API manquante pour les embeddings "
                            + "(configurez le modele d'embeddings dans Parametres > IA)");
        }
        final String model = (target.model() != null && !target.model().isBlank())
                ? target.model() : DEFAULT_MODEL;
        final String baseUrl = (target.baseUrl() != null && !target.baseUrl().isBlank())
                ? target.baseUrl() : DEFAULT_BASE_URL;

        List<float[]> all = new ArrayList<>(texts.size());
        for (int i = 0; i < texts.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, texts.size());
            all.addAll(callApi(texts.subList(i, end), target.apiKey(), model, baseUrl, target.dimensions()));
        }
        return all;
    }

    private List<float[]> callApi(List<String> batch, String apiKey, String model, String baseUrl, int dimensions) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("input", batch);
        body.put("model", model);
        // text-embedding-3-{small,large} supportent la troncature MRL via "dimensions"
        body.put("dimensions", dimensions);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            OpenAIResponse response = restTemplate.postForObject(
                    embeddingsEndpoint(baseUrl),
                    new HttpEntity<>(body, headers),
                    OpenAIResponse.class);
            if (response == null || response.data == null) {
                throw new EmbeddingException("OpenAI embeddings : reponse vide");
            }
            List<float[]> out = new ArrayList<>(response.data.size());
            for (OpenAIData d : response.data) {
                if (d.embedding == null) {
                    out.add(new float[dimensions]);
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

    /** baseUrl peut finir par "/v1" (convention catalogue chat) ou non — on normalise. */
    private static String embeddingsEndpoint(String baseUrl) {
        return baseUrl.endsWith("/v1") ? baseUrl + "/embeddings" : baseUrl + "/v1/embeddings";
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
