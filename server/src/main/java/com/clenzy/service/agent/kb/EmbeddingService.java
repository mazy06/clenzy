package com.clenzy.service.agent.kb;

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
 * Facade des embeddings : selectionne le provider via la property
 * {@code clenzy.ai.embeddings.provider=voyage|openai} (defaut {@code voyage}).
 *
 * <p>Expose aussi {@link #toPgVectorString(float[])} pour serialiser un vecteur
 * dans le format texte attendu par pgvector ({@code "[0.1, 0.2, ...]"}) — utilise
 * a l'insert et dans les native queries de recherche.</p>
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final EmbeddingProvider provider;
    private final boolean autoIngestionEnabled;
    private final double relevanceThreshold;

    public EmbeddingService(List<EmbeddingProvider> providers,
                              @Value("${clenzy.ai.embeddings.provider:voyage}") String providerName,
                              @Value("${clenzy.ai.embeddings.auto-ingestion:false}") boolean autoIngestion,
                              @Value("${clenzy.ai.embeddings.relevance-threshold:0.70}") double relevanceThreshold) {
        Map<String, EmbeddingProvider> byName = providers.stream()
                .collect(Collectors.toMap(p -> p.name().toLowerCase(Locale.ROOT), Function.identity(),
                        (a, b) -> a));
        EmbeddingProvider chosen = byName.get(providerName.toLowerCase(Locale.ROOT));
        if (chosen == null) {
            log.warn("EmbeddingService : provider '{}' inconnu — fallback sur le premier disponible ({})",
                    providerName, providers.isEmpty() ? "none" : providers.get(0).name());
            chosen = providers.isEmpty() ? null : providers.get(0);
        }
        this.provider = chosen;
        this.autoIngestionEnabled = autoIngestion;
        this.relevanceThreshold = relevanceThreshold;
        log.info("EmbeddingService initialise : provider={} dimensions={}",
                provider != null ? provider.name() : "none",
                provider != null ? provider.dimensions() : 0);
    }

    /** Provider courant (peut etre null si aucun bean injecte). */
    public EmbeddingProvider getProvider() {
        return provider;
    }

    /** Dimension attendue par la table kb_chunk (verifie au demarrage). */
    public int dimensions() {
        return provider != null ? provider.dimensions() : 1024;
    }

    /**
     * Genere un embedding et retourne sa representation texte pgvector
     * ({@code "[0.1,0.2,...]"}). Throw si aucun provider configure.
     */
    public String embedAsVectorString(String text) {
        if (provider == null) {
            throw new EmbeddingProvider.EmbeddingException(
                    "Aucun provider embeddings configure (set clenzy.ai.embeddings.provider)");
        }
        return toPgVectorString(provider.embed(text));
    }

    /** Variante batch (ingestion). */
    public List<String> embedBatchAsVectorStrings(List<String> texts) {
        if (provider == null) {
            throw new EmbeddingProvider.EmbeddingException(
                    "Aucun provider embeddings configure");
        }
        return provider.embedBatch(texts).stream()
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
