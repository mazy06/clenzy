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
 * Provider Voyage AI (https://docs.voyageai.com/).
 *
 * <p><b>Modele defaut : {@code voyage-3-large}</b> (1024d, ~$0.18/1M tokens), repli si le
 * catalogue ne fixe pas de {@code modelId}. Recommande par Anthropic pour les embeddings
 * dans un contexte Claude.</p>
 *
 * <p>Endpoint : {@code POST {baseUrl}/v1/embeddings}. Body :
 * {@code {"input": ["..."], "model": "voyage-3-large", "input_type": "query"|"document",
 * "truncation": true}}. L'{@code input_type} suit {@link InputKind} : Voyage optimise
 * differemment les questions et les documents indexes (retrieval asymetrique).</p>
 *
 * <p><b>Credential-stateless</b> : cle/modele/baseUrl viennent de la {@link EmbeddingTarget}
 * resolue par {@link EmbeddingService} depuis la config DB (feature EMBEDDINGS) — plus aucune
 * variable d'environnement. Sans cle, throw {@link EmbeddingException} (fail-fast).</p>
 */
@Component
public class VoyageEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(VoyageEmbeddingProvider.class);
    /** {@code voyage-3-large} : meilleur modele Voyage 1024d. Repli si le catalogue ne fixe rien. */
    static final String DEFAULT_MODEL = "voyage-3-large";
    static final String DEFAULT_BASE_URL = "https://api.voyageai.com";
    private static final int BATCH_SIZE = 128;
    /**
     * Sous-batch en mode ralenti (tier gratuit Voyage : 10K tokens/minute — un
     * batch de 128 chunks × ~500 tokens ne passerait jamais).
     */
    private static final int THROTTLED_BATCH_SIZE = 8;

    private final RestTemplate restTemplate;
    private final VoyageRateThrottle rateThrottle;

    public VoyageEmbeddingProvider(RestTemplate restTemplate, VoyageRateThrottle rateThrottle) {
        this.restTemplate = restTemplate;
        this.rateThrottle = rateThrottle;
    }

    @Override
    public String name() {
        return "voyage";
    }

    @Override
    public float[] embed(String text, EmbeddingTarget target, InputKind kind) {
        if (text == null || text.isBlank()) {
            return new float[target.dimensions()];
        }
        List<float[]> result = embedBatch(List.of(text), target, kind);
        return result.isEmpty() ? new float[target.dimensions()] : result.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts, EmbeddingTarget target, InputKind kind) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (target == null || target.apiKey() == null || target.apiKey().isBlank()) {
            throw new EmbeddingException(
                    "Voyage : cle API manquante (configurez le modele d'embeddings dans Parametres > IA)");
        }
        final String model = (target.model() != null && !target.model().isBlank())
                ? target.model() : DEFAULT_MODEL;
        final String baseUrl = (target.baseUrl() != null && !target.baseUrl().isBlank())
                ? target.baseUrl() : DEFAULT_BASE_URL;

        List<float[]> all = new ArrayList<>(texts.size());
        // L'API Voyage accepte jusqu'a ~128 inputs par requete — on sous-batch.
        // En mode ralenti (429 recent), petits batchs pour tenir sous le TPM du
        // tier gratuit ; le pas de boucle suit la taille effective.
        int batchSize = kind == InputKind.DOCUMENT && rateThrottle.isThrottled()
                ? THROTTLED_BATCH_SIZE : BATCH_SIZE;
        for (int i = 0; i < texts.size(); i += batchSize) {
            int end = Math.min(i + batchSize, texts.size());
            if (kind == InputKind.DOCUMENT) {
                // Chemin d'arriere-plan : respecte ~3 req/min quand throttle actif.
                rateThrottle.awaitSlot();
            }
            all.addAll(callApi(texts.subList(i, end), target.apiKey(), model, baseUrl,
                    target.dimensions(), kind));
        }
        return all;
    }

    private List<float[]> callApi(List<String> batch, String apiKey, String model, String baseUrl,
                                    int dimensions, InputKind kind) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("input", batch);
        body.put("model", model);
        body.put("input_type", kind == InputKind.QUERY ? "query" : "document");
        // Sans truncation, un chunk depassant la fenetre du modele fait echouer tout le batch.
        body.put("truncation", true);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            // Chemin chat (QUERY) : retry court pour ne pas bloquer le tour.
            int attempts = kind == InputKind.QUERY
                    ? AiHttpRetry.QUERY_ATTEMPTS : AiHttpRetry.INGESTION_ATTEMPTS;
            VoyageResponse response = AiHttpRetry.execute("Voyage embeddings", attempts,
                    () -> {
                        try {
                            return restTemplate.postForObject(
                                    embeddingsEndpoint(baseUrl),
                                    new HttpEntity<>(body, headers),
                                    VoyageResponse.class);
                        } catch (RuntimeException e) {
                            // Chaque 429 (meme retente avec succes ensuite) arme le
                            // mode ralenti pour les appels de fond suivants.
                            if (isRateLimit(e)) rateThrottle.onRateLimited();
                            throw e;
                        }
                    });
            if (response == null || response.data == null) {
                throw new EmbeddingException("Voyage API : reponse vide");
            }
            List<float[]> out = new ArrayList<>(response.data.size());
            for (VoyageData d : response.data) {
                if (d.embedding == null) {
                    // Un vecteur zero fausse la distance cosine sans laisser de trace :
                    // on echoue explicitement, l'appelant degradera proprement.
                    throw new EmbeddingException("Voyage API : embedding manquant dans la reponse");
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

    private static boolean isRateLimit(RuntimeException e) {
        return e instanceof org.springframework.web.client.HttpStatusCodeException http
                && http.getStatusCode().value() == 429;
    }

    /** baseUrl peut finir par "/v1" (convention catalogue chat) ou non — on normalise. */
    private static String embeddingsEndpoint(String baseUrl) {
        return baseUrl.endsWith("/v1") ? baseUrl + "/embeddings" : baseUrl + "/v1/embeddings";
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
