package com.clenzy.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.*;
import java.util.Objects;
import java.util.function.ToDoubleFunction;

/** Baitly platform-only counts: never reads scope IDs, PINs, recipients or documents. */
@Component
public class BaitlyExternalEffectMetrics {
    private final JdbcTemplate db;
    private final Clock clock;
    private volatile Snapshot snapshot = new Snapshot(0, 0, 0, 0, 0, 0, 0, 0, 0);

    record Snapshot(long locks, double lockAge, long unknownLocks, long reports, double reportAge,
                    long unknownReports, long partialReports, double healthy, double lastSuccess) {}

    public BaitlyExternalEffectMetrics(JdbcTemplate source, MeterRegistry registry, Clock clock) {
        db = new JdbcTemplate(Objects.requireNonNull(source.getDataSource()));
        db.setQueryTimeout(5);
        db.setMaxRows(1);
        this.clock = clock;
        gauge(registry, "lock.uncertain", Snapshot::locks);
        gauge(registry, "lock.oldest.uncertain.seconds", Snapshot::lockAge);
        gauge(registry, "lock.unknown", Snapshot::unknownLocks);
        gauge(registry, "report.uncertain", Snapshot::reports);
        gauge(registry, "report.oldest.uncertain.seconds", Snapshot::reportAge);
        gauge(registry, "report.unknown", Snapshot::unknownReports);
        gauge(registry, "report.partial", Snapshot::partialReports);
        gauge(registry, "snapshot.healthy", Snapshot::healthy);
        gauge(registry, "snapshot.last.success.timestamp.seconds", Snapshot::lastSuccess);
    }

    private void gauge(MeterRegistry registry, String suffix, ToDoubleFunction<Snapshot> value) {
        Gauge.builder("baitly.external.effect." + suffix, this, metrics -> value.applyAsDouble(metrics.snapshot))
            .description("Baitly external effect aggregate; no customer labels").register(registry);
    }

    /** One bounded read outside scrapes. STARTED remains uncertain, regardless of its age. */
    @Scheduled(fixedDelayString = "${baitly.external-effect.metrics-ms:60000}",
               initialDelayString = "${baitly.external-effect.metrics-initial-ms:30000}")
    public synchronized void refresh() {
        try {
            Instant instant = clock.instant();
            LocalDateTime now = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
            Snapshot next = db.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN kind='LOCK' THEN 1 ELSE 0 END),0),
                    MIN(CASE WHEN kind='LOCK' THEN attempted_at END),
                    COALESCE(SUM(CASE WHEN kind='LOCK' AND state='UNKNOWN' THEN 1 ELSE 0 END),0),
                    COALESCE(SUM(CASE WHEN kind='REPORT' THEN 1 ELSE 0 END),0),
                    MIN(CASE WHEN kind='REPORT' THEN attempted_at END),
                    COALESCE(SUM(CASE WHEN kind='REPORT' AND state='UNKNOWN' THEN 1 ELSE 0 END),0),
                    COALESCE(SUM(CASE WHEN kind='REPORT' AND completed_count>0 THEN 1 ELSE 0 END),0),
                    COALESCE(SUM(CASE WHEN kind IS NULL OR kind NOT IN ('LOCK','REPORT')
                        OR state IS NULL OR state NOT IN ('STARTED','UNKNOWN')
                        OR attempted_at IS NULL OR attempted_at>?
                        OR completed_count IS NULL OR completed_count<0 THEN 1 ELSE 0 END),0)
                FROM baitly_external_effect_attempts WHERE state<>'DONE' OR state IS NULL
                """, (row, index) -> {
                    if (row.getLong(8) != 0) throw new IllegalStateException("EXTERNAL_EFFECT_METRICS_INVALID");
                    return new Snapshot(row.getLong(1), age(row.getObject(2, LocalDateTime.class), now),
                        row.getLong(3), row.getLong(4), age(row.getObject(5, LocalDateTime.class), now),
                        row.getLong(6), row.getLong(7), 1, instant.toEpochMilli() / 1000.0);
                }, now.plusSeconds(60));
            snapshot = Objects.requireNonNull(next);
        } catch (RuntimeException failure) {
            Snapshot old = snapshot;
            snapshot = new Snapshot(old.locks(), old.lockAge(), old.unknownLocks(), old.reports(), old.reportAge(),
                old.unknownReports(), old.partialReports(), 0, old.lastSuccess());
            // Do not log SQL diagnostics, scopes or provider failures. Health exposes collection failure.
        }
    }

    private static double age(LocalDateTime timestamp, LocalDateTime now) {
        return timestamp == null ? 0 : Math.max(0, Duration.between(timestamp, now).toMillis() / 1000.0);
    }
}
