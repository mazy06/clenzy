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

    private final EmbeddingService embeddingService;
    private final KbChunkRepository chunkRepository;

    public KbSearchService(EmbeddingService embeddingService, KbChunkRepository chunkRepository) {
        this.embeddingService = embeddingService;
        this.chunkRepository = chunkRepository;
    }

    /**
     * Recherche les {@code topK} chunks les plus pertinents pour la query, visibles
     * par l'org demandee (incluant les docs globaux).
     *
     * <p>Echec embedding ou DB → retourne liste vide (le caller decidera s'il
     * affiche un message ou ignore — le chat doit jamais casser pour ca).</p>
     */
    @Transactional(readOnly = true)
    public List<KbSearchHit> search(String query, Long organizationId, int topK) {
        if (query == null || query.isBlank()) return List.of();
        int safeTopK = Math.max(1, Math.min(20, topK));

        String queryVector;
        try {
            queryVector = embeddingService.embedAsVectorString(query);
        } catch (Exception e) {
            log.warn("KbSearchService : embed de la query echoue : {}", e.getMessage());
            return List.of();
        }

        List<Object[]> rows;
        try {
            rows = chunkRepository.searchByCosineSimilarity(queryVector, organizationId, safeTopK);
        } catch (Exception e) {
            log.warn("KbSearchService : recherche cosine echouee : {}", e.getMessage());
            return List.of();
        }

        List<KbSearchHit> hits = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            try {
                Long chunkId = ((Number) row[0]).longValue();
                String content = (String) row[1];
                String sourcePath = (String) row[2];
                String title = (String) row[3];
                Long documentId = ((Number) row[4]).longValue();
                double distance = ((Number) row[5]).doubleValue();
                double relevance = Math.max(0.0, Math.min(1.0, 1.0 - distance / 2.0));
                hits.add(new KbSearchHit(
                        chunkId, documentId, title, sourcePath,
                        excerpt(content),
                        BigDecimal.valueOf(relevance).setScale(3, java.math.RoundingMode.HALF_UP)
                                .doubleValue()));
            } catch (Exception e) {
                log.debug("KbSearchService : ligne ignoree (parse error) : {}", e.getMessage());
            }
        }
        return hits;
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
