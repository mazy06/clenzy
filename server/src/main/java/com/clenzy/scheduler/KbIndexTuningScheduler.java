package com.clenzy.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Auto-tuning de l'index ivfflat de {@code kb_chunk.embedding}.
 *
 * <p>L'index ivfflat partitionne les vecteurs en {@code lists} clusters. La
 * valeur optimale suit la regle empirique : {@code lists = sqrt(rows)} pour
 * &lt; 1M lignes (cf. doc pgvector). Avec un seul lists fige au create, l'index
 * devient sous-optimal a mesure que la table grossit.</p>
 *
 * <p>Le scheduler tourne tous les jours a 4h UTC :
 * <ol>
 *   <li>Compte les chunks indexes ({@code embedding IS NOT NULL})</li>
 *   <li>Calcule {@code optimal_lists = max(MIN_LISTS, sqrt(count))}</li>
 *   <li>Lit le DDL actuel via {@code pg_indexes} → parse "lists=N"</li>
 *   <li>Si l'ecart est &gt; 50% ET le mode automatique est actif :
 *       DROP + CREATE INDEX CONCURRENTLY avec le nouveau lists.</li>
 *   <li>Sinon : log WARN avec la recommandation a appliquer manuellement.</li>
 * </ol>
 *
 * <p>L'auto-tune est OFF par defaut ({@code clenzy.assistant.kb.auto-tune-enabled})
 * — operation de maintenance qui doit etre activee consciemment par l'admin.</p>
 */
@Component
public class KbIndexTuningScheduler {

    private static final Logger log = LoggerFactory.getLogger(KbIndexTuningScheduler.class);
    private static final String INDEX_NAME = "idx_kb_chunk_embedding_cosine";
    private static final int MIN_LISTS = 100;
    /** Seuil d'ecart au-dela duquel on considere l'index a re-tune. */
    private static final double DRIFT_THRESHOLD = 0.5;
    private static final Pattern LISTS_PATTERN = Pattern.compile("lists\\s*=\\s*'?(\\d+)'?");

    private final JdbcTemplate jdbcTemplate;
    private final com.clenzy.service.NotificationService notificationService;
    private final boolean enabled;
    private final boolean autoApply;
    /** Notification staff dedupliquee : une fois par boot, pas une par nuit. */
    private final java.util.concurrent.atomic.AtomicBoolean retuneNotified =
            new java.util.concurrent.atomic.AtomicBoolean(false);

    public KbIndexTuningScheduler(JdbcTemplate jdbcTemplate,
                                    com.clenzy.service.NotificationService notificationService,
                                    @Value("${clenzy.assistant.kb.tuning-enabled:true}") boolean enabled,
                                    @Value("${clenzy.assistant.kb.auto-tune-enabled:false}") boolean autoApply) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
        this.enabled = enabled;
        this.autoApply = autoApply;
    }

    /** True si la reconstruction automatique de l'index est activee. */
    public boolean isAutoApplyEnabled() {
        return autoApply;
    }

    /** Tous les jours a 4h UTC : creneau de plus faible activite. */
    @Scheduled(cron = "0 0 4 * * *")
    public void runDaily() {
        runOnce();
    }

    /**
     * Inspection READ-ONLY de la sante de l'index : compte les chunks indexes,
     * lit la valeur {@code lists} courante et calcule le drift — sans jamais
     * appliquer de DDL. Utilisee par le KPI admin ({@code GET /api/admin/kb/stats})
     * et par {@link #runOnce()}.
     */
    public TuningOutcome inspect() {
        long count;
        try {
            Long raw = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM kb_chunk WHERE embedding IS NOT NULL", Long.class);
            count = raw != null ? raw : 0L;
        } catch (Exception e) {
            log.warn("KbIndexTuningScheduler : count failed ({}), skip", e.getMessage());
            return TuningOutcome.error("count failed: " + e.getMessage());
        }

        int optimalLists = computeOptimalLists(count);
        Integer currentLists = readCurrentLists();
        if (currentLists == null) {
            log.info("KbIndexTuningScheduler : index '{}' introuvable ou DDL inattendu (count={}, optimal={}), skip",
                    INDEX_NAME, count, optimalLists);
            return TuningOutcome.indexNotFound(count, optimalLists);
        }

        double drift = relativeDrift(currentLists, optimalLists);
        if (drift <= DRIFT_THRESHOLD) {
            log.debug("KbIndexTuningScheduler : index OK (count={}, lists={}, optimal={}, drift={}%)",
                    count, currentLists, optimalLists, Math.round(drift * 100));
            return TuningOutcome.upToDate(count, currentLists, optimalLists);
        }
        return TuningOutcome.recommendation(count, currentLists, optimalLists);
    }

    /**
     * Execution effective — separee du cron pour permettre l'appel direct dans
     * les tests / endpoints admin.
     *
     * @return resultat de l'inspection (toujours non-null)
     */
    public TuningOutcome runOnce() {
        if (!enabled) {
            log.debug("KbIndexTuningScheduler : disabled, skip");
            return TuningOutcome.disabled();
        }

        TuningOutcome outcome = inspect();
        if (outcome.status() != TuningOutcome.Status.RECOMMENDATION) {
            return outcome;
        }
        long count = outcome.chunkCount();
        int currentLists = outcome.currentLists();
        int optimalLists = outcome.optimalLists();

        log.warn("KbIndexTuningScheduler : index drift detected (count={}, current_lists={}, optimal_lists={})",
                count, currentLists, optimalLists);

        if (!autoApply) {
            log.warn("KbIndexTuningScheduler : auto-tune disabled — applique manuellement :\n" +
                    "  DROP INDEX CONCURRENTLY {};\n" +
                    "  CREATE INDEX CONCURRENTLY {} ON kb_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = {});",
                    INDEX_NAME, INDEX_NAME, optimalLists);
            notifyRetuneRecommended(count, currentLists, optimalLists);
            return outcome;
        }

        try {
            applyTuning(optimalLists);
            log.info("KbIndexTuningScheduler : index re-tuned (count={}, {} → {} lists)",
                    count, currentLists, optimalLists);
            return TuningOutcome.applied(count, currentLists, optimalLists);
        } catch (Exception e) {
            log.error("KbIndexTuningScheduler : auto-tune failed", e);
            return TuningOutcome.error("apply failed: " + e.getMessage());
        }
    }

    /** Alerte le staff plateforme (une fois par boot) : la base a grossi, l'index rame. */
    private void notifyRetuneRecommended(long count, int currentLists, int optimalLists) {
        if (notificationService == null || !retuneNotified.compareAndSet(false, true)) return;
        try {
            notificationService.notifyAllPlatformStaff(
                    com.clenzy.model.NotificationKey.KB_INDEX_RETUNE,
                    "Index de la base de connaissances a recalibrer",
                    "La base de connaissances atteint " + count + " extraits indexes : l'index vectoriel "
                            + "(lists=" + currentLists + ", optimal=" + optimalLists + ") degrade la qualite "
                            + "de recherche de l'assistant. Activez l'auto-tune "
                            + "(clenzy.assistant.kb.auto-tune-enabled) ou recreez l'index — details dans "
                            + "Parametres > IA > Base de connaissances.",
                    "/settings?tab=ai");
        } catch (Exception e) {
            log.warn("KbIndexTuningScheduler : notification retune echouee : {}", e.getMessage());
        }
    }

    /** Formule pgvector : sqrt(N) borne a [{@link #MIN_LISTS}, +inf). */
    static int computeOptimalLists(long count) {
        if (count <= 0) return MIN_LISTS;
        int sqrt = (int) Math.round(Math.sqrt(count));
        return Math.max(MIN_LISTS, sqrt);
    }

    /** abs(optimal - current) / current. */
    private static double relativeDrift(int current, int optimal) {
        if (current <= 0) return Double.MAX_VALUE;
        return Math.abs((double) (optimal - current)) / current;
    }

    /**
     * Lit le DDL de l'index via {@code pg_indexes.indexdef} et parse la valeur
     * de {@code lists}. Retourne null si l'index n'existe pas ou si la regex
     * ne matche pas (DDL non standard, par exemple si l'admin a deja change le
     * type d'index).
     */
    private Integer readCurrentLists() {
        try {
            String ddl = jdbcTemplate.queryForObject(
                    "SELECT indexdef FROM pg_indexes WHERE indexname = ? LIMIT 1",
                    String.class, INDEX_NAME);
            if (ddl == null) return null;
            Matcher m = LISTS_PATTERN.matcher(ddl);
            if (!m.find()) return null;
            return Integer.parseInt(m.group(1));
        } catch (Exception e) {
            log.debug("KbIndexTuningScheduler : readCurrentLists failed : {}", e.getMessage());
            return null;
        }
    }

    /**
     * Recree l'index avec le nouveau {@code lists}. {@code CONCURRENTLY} pour
     * eviter de bloquer les lectures. Le DROP/CREATE n'est PAS dans une
     * transaction explicite : Postgres exige autocommit pour CONCURRENTLY.
     */
    private void applyTuning(int newLists) {
        jdbcTemplate.execute("DROP INDEX CONCURRENTLY IF EXISTS " + INDEX_NAME);
        jdbcTemplate.execute("CREATE INDEX CONCURRENTLY " + INDEX_NAME
                + " ON kb_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = "
                + newLists + ")");
    }

    /**
     * Resultat de l'inspection — expose au caller (tests, endpoint admin
     * eventuel) sans avoir a relire les logs.
     */
    public record TuningOutcome(Status status, long chunkCount, Integer currentLists,
                                  Integer optimalLists, String message) {
        public enum Status {
            DISABLED, INDEX_NOT_FOUND, UP_TO_DATE, RECOMMENDATION, APPLIED, ERROR
        }
        static TuningOutcome disabled() {
            return new TuningOutcome(Status.DISABLED, 0, null, null, "disabled");
        }
        static TuningOutcome error(String msg) {
            return new TuningOutcome(Status.ERROR, 0, null, null, msg);
        }
        static TuningOutcome indexNotFound(long count, int optimal) {
            return new TuningOutcome(Status.INDEX_NOT_FOUND, count, null, optimal, "index missing");
        }
        static TuningOutcome upToDate(long count, int current, int optimal) {
            return new TuningOutcome(Status.UP_TO_DATE, count, current, optimal, "ok");
        }
        static TuningOutcome recommendation(long count, int current, int optimal) {
            return new TuningOutcome(Status.RECOMMENDATION, count, current, optimal,
                    "drift detected, auto-apply disabled");
        }
        static TuningOutcome applied(long count, int current, int optimal) {
            return new TuningOutcome(Status.APPLIED, count, current, optimal, "index rebuilt");
        }
    }
}
