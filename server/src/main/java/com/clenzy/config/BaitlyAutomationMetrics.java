package com.clenzy.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.Objects;
import java.util.function.ToDoubleFunction;

/** Baitly platform aggregates. No tenant, rule, subject, context or diagnostic is read. */
@Component
public class BaitlyAutomationMetrics {
    private final JdbcTemplate db;
    private final Clock clock;
    private volatile Snapshot snapshot = new Snapshot(0, 0, 0, 0, 0, 0, 0, 0, 0);

    record Snapshot(long ready, double readyAge, long uncertain, double uncertainAge,
                    long expired, long review, long legacy, double healthy, double lastSuccess) {}

    public BaitlyAutomationMetrics(JdbcTemplate source, MeterRegistry registry, Clock clock) {
        db = new JdbcTemplate(Objects.requireNonNull(source.getDataSource()));
        db.setQueryTimeout(5);
        db.setMaxRows(1);
        this.clock = clock;
        gauge(registry, "ready", Snapshot::ready);
        gauge(registry, "oldest.ready.seconds", Snapshot::readyAge);
        gauge(registry, "uncertain", Snapshot::uncertain);
        gauge(registry, "oldest.uncertain.seconds", Snapshot::uncertainAge);
        gauge(registry, "expired", Snapshot::expired);
        gauge(registry, "review", Snapshot::review);
        gauge(registry, "legacy.review", Snapshot::legacy);
        gauge(registry, "snapshot.healthy", Snapshot::healthy);
        gauge(registry, "snapshot.last.success.timestamp.seconds", Snapshot::lastSuccess);
    }

    private void gauge(MeterRegistry registry, String suffix, ToDoubleFunction<Snapshot> value) {
        Gauge.builder("baitly.automation." + suffix, this, metrics -> value.applyAsDouble(metrics.snapshot))
            .description("Baitly automation aggregate; no customer labels").register(registry);
    }

    /** Read only, outside the scrape. Preserve the last successful values on any collection failure. */
    @Scheduled(fixedDelayString = "${baitly.automation.metrics-ms:60000}",
               initialDelayString = "${baitly.automation.metrics-initial-ms:30000}")
    public synchronized void refresh() {
        try {
            Instant instant = clock.instant();
            // The journal writes TIMESTAMP wall time in the server zone, not the database session zone.
            LocalDateTime now = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
            Snapshot next = db.queryForObject("""
                WITH classified AS (
                    SELECT scheduled_at, attempted_at,
                        CASE WHEN durable_state='PENDING' AND status='PENDING'
                            AND scheduled_at<=? AND durable_expires_at>=? THEN 1 ELSE 0 END AS ready,
                        CASE WHEN durable_state IN ('STARTED','UNKNOWN') THEN 1 ELSE 0 END AS uncertain,
                        CASE WHEN durable_state='PENDING' AND status='PENDING'
                            AND durable_expires_at<? THEN 1 ELSE 0 END AS expired,
                        CASE WHEN durable_state='REVIEW' THEN 1 ELSE 0 END AS review,
                        CASE WHEN durable_state IS NULL AND status='FAILED' THEN 1 ELSE 0 END AS legacy,
                        CASE WHEN (durable_state='PENDING' AND (status IS NULL OR status<>'PENDING'
                            OR scheduled_at IS NULL OR durable_expires_at IS NULL OR durable_expires_at<scheduled_at))
                            OR (durable_state IN ('STARTED','UNKNOWN') AND (status IS NULL OR status<>'FAILED'
                                OR attempted_at IS NULL OR attempted_at>?))
                            OR (durable_state='REVIEW' AND (status IS NULL OR status<>'FAILED'))
                            OR (durable_state IS NOT NULL AND durable_state NOT IN ('PENDING','STARTED','UNKNOWN','REVIEW','DONE'))
                            THEN 1 ELSE 0 END AS invalid
                    FROM automation_executions
                    WHERE durable_state IS NOT NULL OR status='FAILED'
                )
                SELECT COALESCE(SUM(ready),0), MIN(CASE WHEN ready=1 THEN scheduled_at END),
                    COALESCE(SUM(uncertain),0), MIN(CASE WHEN uncertain=1 THEN attempted_at END),
                    COALESCE(SUM(expired),0), COALESCE(SUM(review),0), COALESCE(SUM(legacy),0),
                    COALESCE(SUM(invalid),0)
                FROM classified
                """, (row, index) -> {
                    if (row.getLong(8) != 0) throw new IllegalStateException("AUTOMATION_METRICS_INVALID");
                    return new Snapshot(row.getLong(1), age(row.getObject(2, LocalDateTime.class), now),
                        row.getLong(3), age(row.getObject(4, LocalDateTime.class), now), row.getLong(5), row.getLong(6),
                        row.getLong(7), 1, instant.toEpochMilli() / 1000.0);
                }, now, now, now, now.plusSeconds(60));
            snapshot = Objects.requireNonNull(next);
        } catch (RuntimeException failure) {
            Snapshot previous = snapshot;
            snapshot = new Snapshot(previous.ready(), previous.readyAge(), previous.uncertain(),
                previous.uncertainAge(), previous.expired(), previous.review(), previous.legacy(), 0, previous.lastSuccess());
            // Intentionally no exception, payload or high-cardinality failure label.
        }
    }

    private static double age(LocalDateTime timestamp, LocalDateTime now) {
        return timestamp == null ? 0 : Math.max(0, Duration.between(timestamp, now).toMillis() / 1000.0);
    }
}
