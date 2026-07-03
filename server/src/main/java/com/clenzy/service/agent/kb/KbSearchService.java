package com.clenzy.service.agent.kb;

import com.clenzy.repository.KbChunkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Recherche par similarite cosine dans la knowledge base.
 *
 * <p>Encapsule {@link KbChunkRepository#searchByCosineSimilarity} et transforme
 * les {@code Object[]} en records typees {@link KbSearchHit}. Utilise par :
 * <ul>
 *   <li>Le tool {@code search_knowledge_base} (resultats expose au LLM)</li>
 *   <li>L'auto-injection RAG dans {@code AgentOrchestrator}</li>
 * </ul>
 *
 * <p>La distance cosine pgvector est dans {@code [0, 2]} ; on convertit en
 * relevance dans {@code [0, 1]} via {@code 1 - distance/2}. Cela rend les
 * resultats plus intuitifs (1 = identique, 0 = oppose).</p>
 */
@Service
public class KbSearchService {

    private static final Logger log = LoggerFactory.getLogger(KbSearchService.class);
    private static final int SNIPPET_MAX_CHARS = 280;
    /** Garde-fou : on ne fetch jamais plus que ca, meme avec un facteur eleve. */
    private static final int MAX_FETCH = 80;

    private final EmbeddingService embeddingService;
    private final KbChunkRepository chunkRepository;
    private final RerankService rerankService;
    private final EmbeddingOrgQuota embeddingOrgQuota;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;

    public KbSearchService(EmbeddingService embeddingService,
                            KbChunkRepository chunkRepository,
                            RerankService rerankService,
                            EmbeddingOrgQuota embeddingOrgQuota,
                            io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        this.embeddingService = embeddingService;
        this.chunkRepository = chunkRepository;
        this.rerankService = rerankService;
        this.embeddingOrgQuota = embeddingOrgQuota;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Recherche les {@code topK} chunks les plus pertinents pour la query, visibles
     * par l'org demandee (incluant les docs globaux).
     *
     * <p><b>Pipeline 2 etapes</b> (si rerank actif) :
     * <ol>
     *   <li>Phase 1 (recall) : over-fetch {@code topK * overFetchFactor} chunks
     *       par cosine similarity — plus large = plus de chances d'avoir le bon</li>
     *   <li>Phase 2 (precision) : re-ranking via {@link RerankService} pour
     *       reordonner finement, garder topK</li>
     * </ol>
     *
     * <p>Si le rerank est desactive, on fait directement la phase cosine avec
     * {@code topK} chunks (comportement initial preserve).</p>
     *
     * <p>Echec embedding ou DB → retourne liste vide. Echec rerank → retourne
     * l'ordre cosine (degradation propre).</p>
     */
    @Transactional(readOnly = true)
    public List<KbSearchHit> search(String query, Long organizationId, int topK) {
        if (query == null || query.isBlank()) return List.of();
        // Quota mensuel org (X10) : au plafond, degradation propre = recherche
        // vide (le chat continue sans contexte kb), compteur pour le monitoring.
        if (!embeddingOrgQuota.tryConsume(organizationId)) {
            meterRegistry.counter("assistant.embeddings.quota_exceeded",
                    "org", String.valueOf(organizationId)).increment();
            log.warn("KbSearchService : quota embeddings mensuel atteint (org={}) — recherche kb sautee",
                    organizationId);
            return List.of();
        }
        int safeTopK = Math.max(1, Math.min(20, topK));
        int fetchK = computeFetchSize(safeTopK);

        String queryVector;
        try {
            queryVector = embeddingService.embedAsVectorString(query);
        } catch (Exception e) {
            log.warn("KbSearchService : embed de la query echoue : {}", e.getMessage());
            return List.of();
        }

        List<Object[]> rows;
        try {
            rows = chunkRepository.searchByCosineSimilarity(queryVector, organizationId, fetchK);
        } catch (Exception e) {
            log.warn("KbSearchService : recherche cosine echouee : {}", e.getMessage());
            return List.of();
        }

        List<KbSearchHit> candidates = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            try {
                Long chunkId = ((Number) row[0]).longValue();
                String content = (String) row[1];
                String sourcePath = (String) row[2];
                String title = (String) row[3];
                Long documentId = ((Number) row[4]).longValue();
                double distance = ((Number) row[5]).doubleValue();
                double relevance = Math.max(0.0, Math.min(1.0, 1.0 - distance / 2.0));
                // On garde le contenu COMPLET dans le candidat pour le rerank,
                // l'excerpt est fait au final apres rerank.
                candidates.add(new KbSearchHit(
                        chunkId, documentId, title, sourcePath,
                        content,
                        BigDecimal.valueOf(relevance).setScale(3, java.math.RoundingMode.HALF_UP)
                                .doubleValue()));
            } catch (Exception e) {
                log.debug("KbSearchService : ligne ignoree (parse error) : {}", e.getMessage());
            }
        }

        // Pas de candidats → return early
        if (candidates.isEmpty()) return List.of();

        // Phase 2 : re-ranking (no-op si rerank desactive / fallback)
        List<KbSearchHit> finalHits = applyRerank(query, candidates, safeTopK);

        // Appliquer l'excerpt en derniere etape (pas avant le rerank pour ne pas
        // perdre du contexte).
        return finalHits.stream()
                .map(h -> new KbSearchHit(h.chunkId(), h.documentId(), h.title(),
                        h.sourcePath(), excerpt(h.snippet()), h.relevance()))
                .toList();
    }

    /**
     * Applique le re-ranking sur la liste de candidats. Garantit que la sortie
     * est au plus {@code topK} elements, jamais null.
     */
    private List<KbSearchHit> applyRerank(String query, List<KbSearchHit> candidates, int topK) {
        if (!rerankService.isActive() || candidates.size() <= topK) {
            // Pas de rerank ou pas assez de candidats pour que ca change quoi que ce soit
            return candidates.stream().limit(topK).toList();
        }
        List<String> texts = candidates.stream().map(KbSearchHit::snippet).toList();
        List<Integer> rerankedIndices = rerankService.rerank(query, texts, topK);
        List<KbSearchHit> result = new ArrayList<>(rerankedIndices.size());
        for (Integer idx : rerankedIndices) {
            if (idx != null && idx >= 0 && idx < candidates.size()) {
                result.add(candidates.get(idx));
            }
        }
        return result.isEmpty() ? candidates.stream().limit(topK).toList() : result;
    }

    /** Calcule combien de chunks fetch en phase 1 selon la conf rerank. */
    int computeFetchSize(int topK) {
        if (!rerankService.isActive()) return topK;
        int fetch = topK * rerankService.getOverFetchFactor();
        return Math.min(fetch, MAX_FETCH);
    }

    private static String excerpt(String content) {
        if (content == null) return "";
        String clean = content.replaceAll("\\s+", " ").trim();
        if (clean.length() <= SNIPPET_MAX_CHARS) return clean;
        return clean.substring(0, SNIPPET_MAX_CHARS - 1) + "…";
    }

    /** Resultat enrichi d'une recherche kb. */
    public record KbSearchHit(
            Long chunkId,
            Long documentId,
            String title,
            String sourcePath,
            String snippet,
            double relevance
    ) {}
}
