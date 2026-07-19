package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

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
    private final VoyageRateThrottle rateThrottle;
    private final ObjectMapper objectMapper;

    /** Un seul run a la fois : l'eval consomme de l'API, pas de runs paralleles. */
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "kb-retrieval-eval");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<EvalStatus> currentStatus =
            new AtomicReference<>(EvalStatus.idle());

    public KbRetrievalEvalService(KbSearchService kbSearchService,
                                    EmbeddingService embeddingService,
                                    VoyageRateThrottle rateThrottle,
                                    ObjectMapper objectMapper) {
        this.kbSearchService = kbSearchService;
        this.embeddingService = embeddingService;
        this.rateThrottle = rateThrottle;
        this.objectMapper = objectMapper;
    }

    /** Question du golden set : rang du doc attendu dans le topK (-1 = absent). */
    public record EvalEntry(String question, String expected, int rank, List<String> retrieved) {}

    /** Rapport d'evaluation : recall@{@value #TOP_K}, MRR et detail par question. */
    public record EvalReport(double recallAtK, double mrr, int total, int hits,
                               List<EvalEntry> entries) {}

    /** Etat du run asynchrone, polle par l'ecran admin. */
    public record EvalStatus(State state, int done, int total, EvalReport report, String error) {
        public enum State { IDLE, RUNNING, DONE, FAILED }
        static EvalStatus idle() { return new EvalStatus(State.IDLE, 0, 0, null, null); }
        static EvalStatus running(int done, int total) {
            return new EvalStatus(State.RUNNING, done, total, null, null);
        }
        static EvalStatus done(EvalReport report) {
            return new EvalStatus(State.DONE, report.total(), report.total(), report, null);
        }
        static EvalStatus failed(String error) {
            return new EvalStatus(State.FAILED, 0, 0, null, error);
        }
    }

    /**
     * Demarre l'evaluation en tache de fond (un seul run a la fois). En mode
     * ralenti Voyage (429 recent, tier gratuit ~3 req/min), le run s'espace de
     * lui-meme — il peut alors durer ~15 min, d'ou l'asynchrone + progression.
     *
     * @return false si un run est deja en cours
     * @throws IllegalStateException si aucun modele EMBEDDINGS n'est configure
     */
    public synchronized boolean start() {
        if (currentStatus.get().state() == EvalStatus.State.RUNNING) {
            return false;
        }
        if (!embeddingService.isConfigured()) {
            throw new IllegalStateException(
                    "Aucun modele d'embeddings configure : assignez un modele a la feature "
                            + "« Embeddings » dans Parametres > IA avant de lancer l'evaluation.");
        }
        List<GoldenEntry> golden = loadGoldenSet();
        currentStatus.set(EvalStatus.running(0, golden.size()));
        executor.submit(() -> {
            try {
                currentStatus.set(EvalStatus.done(runEval(golden)));
            } catch (Exception e) {
                log.warn("KbRetrievalEval : run echoue : {}", e.getMessage());
                currentStatus.set(EvalStatus.failed(e.getMessage()));
            }
        });
        return true;
    }

    /** Etat courant du run (pour le polling de l'UI). */
    public EvalStatus status() {
        return currentStatus.get();
    }

    /**
     * Variante synchrone (IT offline pre-deploiement).
     *
     * @throws IllegalStateException si aucun modele EMBEDDINGS n'est configure
     */
    public EvalReport evaluate() {
        if (!embeddingService.isConfigured()) {
            throw new IllegalStateException(
                    "Aucun modele d'embeddings configure : assignez un modele a la feature "
                            + "« Embeddings » dans Parametres > IA avant de lancer l'evaluation.");
        }
        return runEval(loadGoldenSet());
    }

    private EvalReport runEval(List<GoldenEntry> golden) {
        List<EvalEntry> entries = new ArrayList<>(golden.size());
        for (GoldenEntry entry : golden) {
            entries.add(evaluateQuestion(entry));
            currentStatus.getAndUpdate(s -> s.state() == EvalStatus.State.RUNNING
                    ? EvalStatus.running(entries.size(), golden.size()) : s);
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

    /**
     * Une question : reserve un creneau si l'API est en mode ralenti, et retente
     * UNE fois apres un nouveau creneau si la recherche revient vide pendant un
     * throttle (le vide signifie alors « embed 429 », pas « rien de pertinent »).
     */
    private EvalEntry evaluateQuestion(GoldenEntry entry) {
        rateThrottle.awaitSlot();
        List<String> retrieved = searchPaths(entry.question());
        if (retrieved.isEmpty() && rateThrottle.isThrottled()) {
            rateThrottle.awaitSlot();
            retrieved = searchPaths(entry.question());
        }
        return new EvalEntry(entry.question(), entry.expected(),
                retrieved.indexOf(entry.expected()), retrieved);
    }

    private List<String> searchPaths(String question) {
        return kbSearchService.search(question, null, TOP_K, "fr").stream()
                .map(KbSearchService.KbSearchHit::sourcePath)
                .toList();
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
