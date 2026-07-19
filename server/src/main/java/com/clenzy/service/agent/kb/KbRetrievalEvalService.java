package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Evaluation du retrieval RAG contre le golden set embarque
 * ({@code kb-golden-set.json} : ~40 questions d'hotes → fiche officielle attendue).
 *
 * <p>Execute la MEME recherche hybride que l'assistant (embeddings + full-text +
 * RRF + rerank) sur le corpus reellement indexe, et calcule recall@{@value #TOP_K}
 * et MRR. Declenchable depuis l'ecran admin (bouton « Evaluer le retrieval ») —
 * c'est l'outil de mesure avant/apres tout changement de seuil, de chunking ou de
 * modele. Cout : ~40 embeddings de requete + reranks, quelques centimes.</p>
 *
 * <p>Le golden set cible les documents globaux fr ({@code baitly/fr/...}) :
 * l'evaluation tourne en scope global ({@code orgId = null}), langue fr.</p>
 */
@Service
public class KbRetrievalEvalService {

    private static final Logger log = LoggerFactory.getLogger(KbRetrievalEvalService.class);
    private static final String GOLDEN_SET_RESOURCE = "/kb-golden-set.json";
    public static final int TOP_K = 4;

    private final KbSearchService kbSearchService;
    private final EmbeddingService embeddingService;
    private final ObjectMapper objectMapper;

    public KbRetrievalEvalService(KbSearchService kbSearchService,
                                    EmbeddingService embeddingService,
                                    ObjectMapper objectMapper) {
        this.kbSearchService = kbSearchService;
        this.embeddingService = embeddingService;
        this.objectMapper = objectMapper;
    }

    /** Question du golden set : rang du doc attendu dans le topK (-1 = absent). */
    public record EvalEntry(String question, String expected, int rank, List<String> retrieved) {}

    /** Rapport d'evaluation : recall@{@value #TOP_K}, MRR et detail par question. */
    public record EvalReport(double recallAtK, double mrr, int total, int hits,
                               List<EvalEntry> entries) {}

    /**
     * Lance l'evaluation complete. Sequentiel (~30s pour 40 questions).
     *
     * @throws IllegalStateException si aucun modele EMBEDDINGS n'est configure
     *         (les recherches renverraient vide, les metriques seraient un mensonge)
     */
    public EvalReport evaluate() {
        if (!embeddingService.isConfigured()) {
            throw new IllegalStateException(
                    "Aucun modele d'embeddings configure : assignez un modele a la feature "
                            + "« Embeddings » dans Parametres > IA avant de lancer l'evaluation.");
        }
        List<GoldenEntry> golden = loadGoldenSet();

        List<EvalEntry> entries = new ArrayList<>(golden.size());
        for (GoldenEntry entry : golden) {
            List<String> retrieved = kbSearchService
                    .search(entry.question(), null, TOP_K, "fr").stream()
                    .map(KbSearchService.KbSearchHit::sourcePath)
                    .toList();
            entries.add(new EvalEntry(entry.question(), entry.expected(),
                    retrieved.indexOf(entry.expected()), retrieved));
        }

        int hits = (int) entries.stream().filter(e -> e.rank() >= 0).count();
        double recall = entries.isEmpty() ? 0.0 : (double) hits / entries.size();
        double mrr = entries.stream()
                .mapToDouble(e -> e.rank() >= 0 ? 1.0 / (e.rank() + 1) : 0.0)
                .average().orElse(0.0);

        log.info("KbRetrievalEval : recall@{}={} ({} sur {}), MRR={}",
                TOP_K, String.format(java.util.Locale.ROOT, "%.2f", recall),
                hits, entries.size(),
                String.format(java.util.Locale.ROOT, "%.3f", mrr));
        return new EvalReport(recall, mrr, entries.size(), hits, entries);
    }

    private record GoldenEntry(String question, String expected) {}

    private List<GoldenEntry> loadGoldenSet() {
        try (InputStream in = getClass().getResourceAsStream(GOLDEN_SET_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Golden set introuvable : " + GOLDEN_SET_RESOURCE);
            }
            JsonNode root = objectMapper.readTree(in);
            List<GoldenEntry> entries = new ArrayList<>(root.size());
            for (JsonNode node : root) {
                entries.add(new GoldenEntry(
                        node.path("question").asText(),
                        node.path("expected").asText()));
            }
            return entries;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Lecture du golden set impossible", e);
        }
    }
}
