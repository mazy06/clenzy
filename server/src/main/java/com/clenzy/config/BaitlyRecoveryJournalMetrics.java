package com.clenzy.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Agrégats plateforme Baitly : aucun identifiant, empreinte, montant ou secret dans les métriques. */
@Component
public class BaitlyRecoveryJournalMetrics {
    private static final Logger log = LoggerFactory.getLogger(BaitlyRecoveryJournalMetrics.class);
    private static final String HISTORICAL = "0".repeat(64);
    private final JdbcTemplate jdbc;
    private final MeterRegistry registry;
    private volatile Snapshot snapshot = new Snapshot(0,0,0,0,0,0,new MinutSnapshot(0,0,0,0,0));
    private volatile double lastSuccess;
    private volatile boolean healthy;
    private boolean attempted;

    record Snapshot(long inflight, long unknown, long historicalReview,
                    double inflightAge, double unknownAge, long oauthBlocked, MinutSnapshot minut) {}
    record MinutSnapshot(long ready,long uncertain,long review,double readyAge,double uncertainAge) {}

    public BaitlyRecoveryJournalMetrics(JdbcTemplate jdbc, MeterRegistry registry) {
        this.jdbc = new JdbcTemplate(java.util.Objects.requireNonNull(jdbc.getDataSource()));
        this.jdbc.setQueryTimeout(5);
        this.jdbc.setMaxRows(1);
        this.registry = registry;
        gauge("accounting.inflight", () -> snapshot.inflight());
        gauge("accounting.unknown", () -> snapshot.unknown());
        gauge("accounting.historical.review", () -> snapshot.historicalReview());
        gauge("accounting.oldest.inflight.seconds", () -> snapshot.inflightAge());
        gauge("accounting.oldest.unknown.seconds", () -> snapshot.unknownAge());
        Gauge.builder("baitly.recovery.oauth.blocked.scopes", () -> snapshot.oauthBlocked())
                .description("All durable OAuth fences, including expected disconnected accounts; not an error count")
                .strongReference(true).register(registry);
        gauge("minut.ready", () -> snapshot.minut().ready());
        gauge("minut.uncertain", () -> snapshot.minut().uncertain());
        gauge("minut.review", () -> snapshot.minut().review());
        gauge("minut.oldest.ready.seconds", () -> snapshot.minut().readyAge());
        gauge("minut.oldest.uncertain.seconds", () -> snapshot.minut().uncertainAge());
        gauge("snapshot.last.success.timestamp.seconds", () -> lastSuccess);
        gauge("snapshot.healthy", () -> healthy ? 1 : 0);
    }

    private void gauge(String suffix, java.util.function.DoubleSupplier value) {
        Gauge.builder("baitly.recovery." + suffix,value,java.util.function.DoubleSupplier::getAsDouble)
                .description("Baitly recovery journal aggregate; no customer labels")
                .strongReference(true).register(registry);
    }

    /** Lecture hors du scrape, sans effet externe : chaque instance conserve son propre échantillon. */
    @Scheduled(fixedDelayString = "${baitly.recovery.metrics.refresh-ms:60000}",
            initialDelayString = "${baitly.recovery.metrics.initial-delay-ms:20000}")
    public void refresh() {
        try {
            Snapshot accounting = jdbc.queryForObject("""
                    SELECT COALESCE(SUM(CASE WHEN state='SENDING' THEN 1 ELSE 0 END),0),
                      COALESCE(SUM(CASE WHEN state='UNKNOWN' AND fingerprint<>? THEN 1 ELSE 0 END),0),
                      COALESCE(SUM(CASE WHEN state='UNKNOWN' AND fingerprint=? THEN 1 ELSE 0 END),0),
                      COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(CASE WHEN state='SENDING' THEN created_at END))),0),
                      COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(CASE WHEN state='UNKNOWN' AND fingerprint<>? THEN created_at END))),0)
                    FROM baitly_accounting_exports WHERE state IN ('SENDING','UNKNOWN')
                    """, (rs,row) -> new Snapshot(rs.getLong(1),rs.getLong(2),rs.getLong(3),
                    Math.max(0,rs.getDouble(4)),Math.max(0,rs.getDouble(5)),0,null),HISTORICAL,HISTORICAL,HISTORICAL);
            Long blocked = jdbc.queryForObject("SELECT COUNT(*) FROM baitly_oauth_refresh_attempts",Long.class);
            MinutSnapshot minut=jdbc.queryForObject("""
                    SELECT COALESCE(SUM(CASE WHEN state='READY' THEN 1 ELSE 0 END),0),
                      COALESCE(SUM(CASE WHEN state IN ('STARTED','UNKNOWN') THEN 1 ELSE 0 END),0),
                      COALESCE(SUM(CASE WHEN state='REVIEW' THEN 1 ELSE 0 END),0),
                      COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(CASE WHEN state='READY' THEN updated_at END))),0),
                      COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(CASE WHEN state IN ('STARTED','UNKNOWN') THEN updated_at END))),0)
                    FROM baitly_minut_events WHERE state IN ('READY','STARTED','UNKNOWN','REVIEW')
                    """,(rs,row) -> new MinutSnapshot(rs.getLong(1),rs.getLong(2),rs.getLong(3),
                            Math.max(0,rs.getDouble(4)),Math.max(0,rs.getDouble(5))));
            // Aucun nouvel agrégat n'est publié si une des trois lectures échoue.
            snapshot = new Snapshot(accounting.inflight(),accounting.unknown(),accounting.historicalReview(),
                    accounting.inflightAge(),accounting.unknownAge(),java.util.Objects.requireNonNull(blocked),java.util.Objects.requireNonNull(minut));
            lastSuccess = registry.config().clock().wallTime()/1000.0;
            healthy = true;
        } catch (RuntimeException ignored) {
            if (healthy || !attempted) log.warn("Baitly recovery journal metrics unavailable; previous sample retained");
            healthy = false;
        } finally { attempted = true; }
    }
}
