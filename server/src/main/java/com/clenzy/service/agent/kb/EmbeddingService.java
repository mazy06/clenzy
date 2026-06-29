package com.clenzy.service.agent.kb;

import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.service.PlatformAiConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Facade des embeddings RAG. <b>Source de verite unique = la config DB plateforme</b> :
 * le modele assigne a la feature {@link AiFeature#EMBEDDINGS} (provider voyage/openai + cle +
 * baseUrl) est resolu a chaque appel via {@link PlatformAiConfigService}. Plus aucune cle ni
 * provider en variable d'environnement.
 *
 * <p>Le modele d'embeddings est <b>platform-global</b> : la dimension de l'index pgvector
 * {@code kb_chunk.embedding} est figee a {@value #VECTOR_DIMENSIONS}, donc pas de BYOK org.</p>
 *
 * <p>Si aucun modele EMBEDDINGS n'est configure/disponible, les methodes lèvent
 * {@link EmbeddingProvider.EmbeddingException} — les appelants RAG (KbSearchService,
 * IngestionService) la capturent et degradent proprement (recherche vide / chunks sans vecteur).</p>
 *
 * <p>Expose aussi {@link #toPgVectorString(float[])} pour serialiser un vecteur au format texte
 * pgvector ({@code "[0.1, 0.2, ...]"}).</p>
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    /** Dimension figee de l'index pgvector {@code kb_chunk.embedding}. */
    public static final int VECTOR_DIMENSIONS = 1024;

    private final Map<String, EmbeddingProvider> providersByName;
    private final PlatformAiConfigService platformAiConfigService;
    private final boolean autoIngestionEnabled;
    private final double relevanceThreshold;

    public EmbeddingService(List<EmbeddingProvider> providers,
                              PlatformAiConfigService platformAiConfigService,
                              @Value("${clenzy.ai.embeddings.auto-ingestion:false}") boolean autoIngestion,
                              @Value("${clenzy.ai.embeddings.relevance-threshold:0.70}") double relevanceThreshold) {
        this.providersByName = providers.stream()
                .collect(Collectors.toMap(p -> p.name().toLowerCase(Locale.ROOT), Function.identity(),
                        (a, b) -> a));
        this.platformAiConfigService = platformAiConfigService;
        this.autoIngestionEnabled = autoIngestion;
        this.relevanceThreshold = relevanceThreshold;
        log.info("EmbeddingService initialise : providers disponibles={} dimensions={}",
                providersByName.keySet(), VECTOR_DIMENSIONS);
    }

    /** Provider + cible resolus depuis la config DB (feature EMBEDDINGS). */
    private record Resolved(EmbeddingProvider provider, EmbeddingProvider.EmbeddingTarget target) {}

    /**
     * Resout le provider d'embeddings + sa cible depuis la config DB (modele assigne a
     * EMBEDDINGS, cle non vide, non marque UNAVAILABLE). Retourne {@code null} si rien
     * d'exploitable n'est configure.
     */
    private Resolved resolve() {
        return platformAiConfigService.getActiveModelForFeature(AiFeature.EMBEDDINGS.name())
                .filter(m -> m.getApiKey() != null && !m.getApiKey().isBlank())
                .filter(m -> m.getAvailabilityStatus() != AiModelAvailability.UNAVAILABLE)
                .map(m -> {
                    String providerName = m.getProvider() == null ? "" : m.getProvider().toLowerCase(Locale.ROOT);
                    EmbeddingProvider provider = providersByName.get(providerName);
                    if (provider == null) {
                        log.warn("EmbeddingService : provider '{}' (modele EMBEDDINGS) sans implementation",
                                m.getProvider());
                        return null;
                    }
                    return new Resolved(provider, new EmbeddingProvider.EmbeddingTarget(
                            m.getApiKey(), m.getModelId(), m.getBaseUrl(), VECTOR_DIMENSIONS));
                })
                .orElse(null);
    }

    private Resolved requireResolved() {
        Resolved r = resolve();
        if (r == null) {
            throw new EmbeddingProvider.EmbeddingException(
                    "Aucun modele d'embeddings configure et disponible. Assignez un modele a la feature "
                            + "« Embeddings » dans Parametres > IA.");
        }
        return r;
    }

    /** Dimension attendue par la table kb_chunk (figee). */
    public int dimensions() {
        return VECTOR_DIMENSIONS;
    }

    /**
     * Genere un embedding et retourne sa representation texte pgvector
     * ({@code "[0.1,0.2,...]"}). Throw si aucun modele EMBEDDINGS configure.
     */
    public String embedAsVectorString(String text) {
        Resolved r = requireResolved();
        return toPgVectorString(r.provider().embed(text, r.target()));
    }

    /** Variante batch (ingestion). Throw si aucun modele EMBEDDINGS configure. */
    public List<String> embedBatchAsVectorStrings(List<String> texts) {
        Resolved r = requireResolved();
        return r.provider().embedBatch(texts, r.target()).stream()
                .map(EmbeddingService::toPgVectorString)
                .toList();
    }

    /** Active l'auto-injection RAG dans le system prompt de chaque tour. */
    public boolean isAutoIngestionEnabled() {
        return autoIngestionEnabled;
    }

    /** Seuil de relevance (cosine distance → relevance via 1 - d/2). */
    public double getRelevanceThreshold() {
        return relevanceThreshold;
    }

    // ─── Helpers pgvector text format ───────────────────────────────────────

    /**
     * Convertit un {@code float[]} en representation texte pgvector
     * {@code "[v1,v2,...]"} (Locale ROOT pour le point decimal).
     */
    public static String toPgVectorString(float[] vector) {
        if (vector == null || vector.length == 0) return "[]";
        StringBuilder sb = new StringBuilder(vector.length * 12);
        sb.append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(Locale.ROOT, "%.6f", vector[i]));
        }
        sb.append(']');
        return sb.toString();
    }
}
