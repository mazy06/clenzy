package com.clenzy.service.agent.kb;

import com.clenzy.repository.KbChunkRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Recherche hybride dans la knowledge base : vectorielle (pgvector, cosine)
 * + lexicale (full-text Postgres), fusionnees par Reciprocal Rank Fusion.
 *
 * <p>Transforme les {@code Object[]} des native queries en records typees
 * {@link KbSearchHit}. Utilise par :
 * <ul>
 *   <li>Le tool {@code search_knowledge_base} (resultats expose au LLM)</li>
 *   <li>L'auto-injection RAG dans {@code AgentOrchestrator}</li>
 * </ul>
 *
 * <p>La distance cosine pgvector est dans {@code [0, 2]} ; on convertit en
 * relevance dans {@code [0, 1]} via {@code 1 - distance/2}. Cela rend les
 * resultats plus intuitifs (1 = identique, 0 = oppose). Les hits lexicaux
 * portent aussi cette relevance cosine (calculee en SQL) — la semantique du
 * score est homogene quel que soit le volet qui a trouve le chunk.</p>
 */
@Service
public class KbSearchService {

    private static final Logger log = LoggerFactory.getLogger(KbSearchService.class);
    /**
     * Troncature des snippets retournes. Les chunks font jusqu'a ~2000 chars :
     * tronquer trop court (ancien 280) faisait retrouver la bonne section au
     * retrieval... sans que le LLM puisse la lire. 1500 ≈ le chunk quasi entier.
     */
    private static final int SNIPPET_MAX_CHARS = 1500;
    private static final java.util.Set<String> SUPPORTED_LANGS = java.util.Set.of("fr", "en", "ar");
    /** Garde-fou : on ne fetch jamais plus que ca, meme avec un facteur eleve. */
    private static final int MAX_FETCH = 80;
    /** Constante k du Reciprocal Rank Fusion (valeur standard de la litterature). */
    private static final int RRF_K = 60;

    private final EmbeddingService embeddingService;
    private final KbChunkRepository chunkRepository;
    private final RerankService rerankService;
    private final EmbeddingOrgQuota embeddingOrgQuota;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;
    private final TransactionTemplate readOnlyTransaction;
    private final int ivfflatProbes;

    @PersistenceContext
    private EntityManager entityManager;

    public KbSearchService(EmbeddingService embeddingService,
                            KbChunkRepository chunkRepository,
                            RerankService rerankService,
                            EmbeddingOrgQuota embeddingOrgQuota,
                            io.micrometer.core.instrument.MeterRegistry meterRegistry,
                            PlatformTransactionManager transactionManager,
                            @Value("${clenzy.assistant.kb.ivfflat-probes:10}") int ivfflatProbes) {
        this.embeddingService = embeddingService;
        this.chunkRepository = chunkRepository;
        this.rerankService = rerankService;
        this.embeddingOrgQuota = embeddingOrgQuota;
        this.meterRegistry = meterRegistry;
        this.readOnlyTransaction = new TransactionTemplate(transactionManager);
        this.readOnlyTransaction.setReadOnly(true);
        this.ivfflatProbes = Math.max(1, Math.min(100, ivfflatProbes));
    }

    /** Seuil de relevance configure ({@code clenzy.ai.embeddings.relevance-threshold}). */
    public double getRelevanceThreshold() {
        return embeddingService.getRelevanceThreshold();
    }

    /** fr/en/ar supportes ("en-US" → en) ; tout le reste retombe sur fr. */
    static String normalizeLang(String lang) {
        if (lang == null || lang.isBlank()) return "fr";
        String base = lang.toLowerCase(java.util.Locale.ROOT).split("[-_]")[0];
        return SUPPORTED_LANGS.contains(base) ? base : "fr";
    }

    /** Recherche avec la langue par defaut (fr) — retrocompatibilite. */
    public List<KbSearchHit> search(String query, Long organizationId, int topK) {
        return search(query, organizationId, topK, "fr");
    }

    /**
     * Recherche les {@code topK} chunks les plus pertinents pour la query, visibles
     * par l'org demandee : docs globaux <b>dans la langue demandee</b> (le corpus
     * Baitly est seede en fr/en/ar) + tous les docs de l'org (non filtres par langue).
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
     * <p>L'embedding de la query (appel HTTP) se fait <b>hors transaction</b> ;
     * seules les requetes SQL (probes + cosine + full-text) tournent dans une
     * transaction read-only courte — regle projet : pas d'appel externe dans une
     * transaction DB.</p>
     *
     * <p>Echec embedding ou DB → retourne liste vide. Echec rerank → retourne
     * l'ordre cosine (degradation propre).</p>
     */
    public List<KbSearchHit> search(String query, Long organizationId, int topK, String lang) {
        if (query == null || query.isBlank()) return List.of();
        final String safeLang = normalizeLang(lang);
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
            queryVector = embeddingService.embedQueryAsVectorString(query);
        } catch (Exception e) {
            log.warn("KbSearchService : embed de la query echoue : {}", e.getMessage());
            return List.of();
        }

        // Requetes SQL dans des transactions read-only courtes et INDEPENDANTES
        // (l'embed HTTP est deja fait ; une erreur SQL du volet lexical avorterait
        // sinon toute la transaction Postgres, resultats vectoriels compris).
        final String qv = queryVector;
        List<KbSearchHit> vectorHits;
        try {
            List<Object[]> rows = readOnlyTransaction.execute(status -> {
                applyIvfflatProbes();
                return chunkRepository.searchByCosineSimilarity(
                        qv, organizationId, safeLang, fetchK);
            });
            vectorHits = parseRows(rows == null ? List.of() : rows);
        } catch (Exception e) {
            log.warn("KbSearchService : recherche cosine echouee : {}", e.getMessage());
            return List.of();
        }

        // Volet lexical (hybride). Degradation propre : un echec full-text ne
        // casse pas la recherche, on retombe sur le vectoriel seul.
        List<KbSearchHit> textHits;
        try {
            List<Object[]> rows = readOnlyTransaction.execute(status ->
                    chunkRepository.searchByTextRank(
                            query, qv, organizationId, safeLang, fetchK));
            textHits = parseRows(rows == null ? List.of() : rows);
        } catch (Exception e) {
            log.debug("KbSearchService : recherche full-text echouee ({}), vectoriel seul",
                    e.getMessage());
            textHits = List.of();
        }

        List<KbSearchHit> candidates = fuseByReciprocalRank(vectorHits, textHits);

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
     * Parse les lignes {@code [chunkId, content, sourcePath, title, documentId,
     * distance]} des native queries. La distance est nullable (chunk sans
     * embedding trouve par le volet lexical) → relevance 0. Le contenu COMPLET
     * est garde dans le candidat pour le rerank, l'excerpt est fait apres.
     */
    private List<KbSearchHit> parseRows(List<Object[]> rows) {
        List<KbSearchHit> hits = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            try {
                Long chunkId = ((Number) row[0]).longValue();
                String content = (String) row[1];
                String sourcePath = (String) row[2];
                String title = (String) row[3];
                Long documentId = ((Number) row[4]).longValue();
                double distance = row[5] == null ? 2.0 : ((Number) row[5]).doubleValue();
                double relevance = Math.max(0.0, Math.min(1.0, 1.0 - distance / 2.0));
                hits.add(new KbSearchHit(
                        chunkId, documentId, title, sourcePath,
                        content,
                        BigDecimal.valueOf(relevance).setScale(3, java.math.RoundingMode.HALF_UP)
                                .doubleValue()));
            } catch (Exception e) {
                log.debug("KbSearchService : ligne ignoree (parse error) : {}", e.getMessage());
            }
        }
        return hits;
    }

    /**
     * Reciprocal Rank Fusion : chaque volet vote {@code 1/(k + rang)} pour ses
     * chunks ; un chunk present dans les deux classements cumule. Robuste sans
     * calibration (les scores cosine et ts_rank ne sont pas comparables entre
     * eux, leurs rangs le sont). Sortie bornee a {@link #MAX_FETCH} candidats,
     * la relevance affichee reste la relevance cosine du chunk.
     */
    private static List<KbSearchHit> fuseByReciprocalRank(List<KbSearchHit> vectorHits,
                                                            List<KbSearchHit> textHits) {
        Map<Long, KbSearchHit> byId = new LinkedHashMap<>();
        Map<Long, Double> scores = new LinkedHashMap<>();
        for (List<KbSearchHit> ranking : List.of(vectorHits, textHits)) {
            for (int rank = 0; rank < ranking.size(); rank++) {
                KbSearchHit hit = ranking.get(rank);
                byId.putIfAbsent(hit.chunkId(), hit);
                scores.merge(hit.chunkId(), 1.0 / (RRF_K + rank + 1), Double::sum);
            }
        }
        return scores.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .limit(MAX_FETCH)
                .map(e -> byId.get(e.getKey()))
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

    /**
     * Regle {@code ivfflat.probes} pour la transaction courante ({@code SET LOCAL}).
     * Le defaut Postgres (1 probe) ne visite qu'une des ~100 listes de l'index →
     * recall tres degrade ; 10 probes est le compromis recommande par pgvector.
     * Best-effort : sans EntityManager (tests unitaires) ou en cas d'echec, la
     * recherche continue avec le defaut.
     */
    private void applyIvfflatProbes() {
        if (entityManager == null) return;
        try {
            // Valeur clampee [1,100] au constructeur — pas de parametre bindable dans SET
            entityManager.createNativeQuery("SET LOCAL ivfflat.probes = " + ivfflatProbes)
                    .executeUpdate();
        } catch (Exception e) {
            log.debug("KbSearchService : SET LOCAL ivfflat.probes ignore : {}", e.getMessage());
        }
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
