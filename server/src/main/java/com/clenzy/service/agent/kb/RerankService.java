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
 * Facade rerank : selectionne le provider configure et fournit une API stable
 * aux callers. Encapsule la logique de fallback (NoOp si rerank desactive ou
 * provider down) — garantit que le caller obtient toujours une liste utilisable.
 *
 * <p>Configuration (properties) :
 * <ul>
 *   <li>{@code clenzy.ai.rerank.enabled} (defaut {@code true})</li>
 *   <li>{@code clenzy.ai.rerank.provider=voyage|noop} (defaut {@code voyage})</li>
 *   <li>{@code clenzy.ai.rerank.over-fetch-factor} (defaut {@code 4}) — combien
 *       de docs over-fetch dans la phase 1 (cosine) avant rerank</li>
 * </ul>
 *
 * <p>Modele SOLID : DI sur la liste de {@link RerankProvider}, le service
 * resout par nom au boot. Ajouter un nouveau provider = nouveau bean Spring,
 * aucune modif ici.</p>
 */
@Service
public class RerankService {

    private static final Logger log = LoggerFactory.getLogger(RerankService.class);
    private static final int DEFAULT_OVER_FETCH_FACTOR = 4;
    private static final int MIN_OVER_FETCH_FACTOR = 1;
    private static final int MAX_OVER_FETCH_FACTOR = 10;

    private final RerankProvider provider;
    private final RerankProvider fallback;
    private final boolean enabled;
    private final int overFetchFactor;

    public RerankService(List<RerankProvider> providers,
                          NoOpRerankProvider noOpProvider,
                          @Value("${clenzy.ai.rerank.enabled:true}") boolean enabled,
                          @Value("${clenzy.ai.rerank.provider:voyage}") String providerName,
                          @Value("${clenzy.ai.rerank.over-fetch-factor:4}") int overFetchFactor) {
        Map<String, RerankProvider> byName = providers.stream()
                .collect(Collectors.toMap(p -> p.name().toLowerCase(Locale.ROOT),
                        Function.identity(), (a, b) -> a));
        RerankProvider chosen = byName.get(providerName.toLowerCase(Locale.ROOT));
        if (chosen == null) {
            log.warn("RerankService : provider '{}' inconnu, fallback noop", providerName);
            chosen = noOpProvider;
        } else if (!chosen.isAvailable()) {
            log.info("RerankService : provider '{}' indisponible (cle API ?), fallback noop",
                    chosen.name());
            chosen = noOpProvider;
        }
        this.provider = chosen;
        this.fallback = noOpProvider;
        this.enabled = enabled;
        this.overFetchFactor = clamp(overFetchFactor);
        log.info("RerankService initialise : enabled={} provider={} overFetch={}x",
                enabled, provider.name(), this.overFetchFactor);
    }

    /**
     * Reordonne les documents par pertinence. En cas d'echec rerank, retourne
     * l'ordre d'entree tronque (fallback NoOp). Le caller n'a pas a gerer les
     * erreurs reseau.
     *
     * @param query     question
     * @param documents textes des documents
     * @param topK      nombre de resultats finals
     * @return indices reordonnes, max topK elements
     */
    public List<Integer> rerank(String query, List<String> documents, int topK) {
        if (documents == null || documents.isEmpty()) return List.of();
        if (!enabled || provider == fallback) {
            return fallback.rerank(query, documents, topK);
        }
        try {
            List<Integer> reranked = provider.rerank(query, documents, topK);
            if (reranked == null || reranked.isEmpty()) {
                // Provider a retourne vide alors qu'il y avait des docs : fallback safe
                return fallback.rerank(query, documents, topK);
            }
            return reranked;
        } catch (Exception e) {
            log.warn("RerankService : echec rerank ({}), fallback ordre cosine", e.getMessage());
            return fallback.rerank(query, documents, topK);
        }
    }

    /** Facteur d'over-fetch a appliquer au topK pour la phase cosine. */
    public int getOverFetchFactor() {
        return overFetchFactor;
    }

    /** True si le rerank est actif ET le provider exploitable. */
    public boolean isActive() {
        return enabled && provider != fallback;
    }

    /** Provider courant — utile pour les tests et la diagnostic. */
    public String activeProviderName() {
        return provider.name();
    }

    private static int clamp(int value) {
        return Math.max(MIN_OVER_FETCH_FACTOR, Math.min(MAX_OVER_FETCH_FACTOR, value));
    }
}
