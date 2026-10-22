package com.clenzy.config;

import com.clenzy.service.OutboxRelay;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Platform-only aggregates: never expose tenant IDs, destinations, payloads or error text. */
@Component
public class BaitlyOperationalMetrics {
    private static final Logger log = LoggerFactory.getLogger(BaitlyOperationalMetrics.class);
    private final JdbcTemplate jdbc;
    private final MeterRegistry registry;
    private volatile Snapshot snapshot = new Snapshot(0, 0, 0, 0, 0, 0, 0);
    private volatile double lastSuccess;
    private volatile boolean healthy;
    private boolean attempted;

    record Snapshot(long pending, long retryable, long exhausted, double outboxAge,
                    long overdueWebhooks, double webhookAge, long disabledWebhooks) {}

    public BaitlyOperationalMetrics(JdbcTemplate jdbc, MeterRegistry registry) {
        this.jdbc = new JdbcTemplate(java.util.Objects.requireNonNull(jdbc.getDataSource()));
        this.jdbc.setQueryTimeout(5);
        this.jdbc.setMaxRows(1);
        this.registry = registry;
        gauge("outbox.pending", () -> snapshot.pending());
        gauge("outbox.retryable", () -> snapshot.retryable());
        gauge("outbox.exhausted", () -> snapshot.exhausted());
        gauge("outbox.oldest.age.seconds", () -> snapshot.outboxAge());
        gauge("webhooks.overdue", () -> snapshot.overdueWebhooks());
        gauge("webhooks.oldest.overdue.seconds", () -> snapshot.webhookAge());
        gauge("webhooks.disabled", () -> snapshot.disabledWebhooks());
        gauge("snapshot.last.success.timestamp.seconds", () -> lastSuccess);
        gauge("snapshot.healthy", () -> healthy ? 1 : 0);
    }

    private void gauge(String suffix, java.util.function.DoubleSupplier value) {
        Gauge.builder("baitly.ops." + suffix, value, java.util.function.DoubleSupplier::getAsDouble)
                .description("Baitly aggregate operational state; no customer labels")
                .strongReference(true).register(registry);
    }

    /**
     * Read off the scrape path; a failed refresh must not turn a broken queue into zero.
     * Deliberately instance-local (SchedulerLockCoverageTest category A): every process
     * needs its own in-memory gauges; SQL reads have no external side effects.
     */
    @Scheduled(fixedDelayString = "${baitly.ops.metrics.refresh-ms:30000}",
               initialDelayString = "${baitly.ops.metrics.initial-delay-ms:15000}")
    public void refresh() {
        try {
            Snapshot outbox = jdbc.queryForObject("""
                    SELECT COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0),
                      COALESCE(SUM(CASE WHEN status = 'FAILED'
                        AND (retry_count < ? OR topic = 'baitly.assignment.jobs') THEN 1 ELSE 0 END), 0),
                      COALESCE(SUM(CASE WHEN status = 'FAILED'
                        AND retry_count >= ? AND topic <> 'baitly.assignment.jobs' THEN 1 ELSE 0 END), 0),
                      COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(created_at))), 0)
                    FROM outbox_events WHERE status IN ('PENDING', 'FAILED')
                    """, (rs, row) -> new Snapshot(rs.getLong(1), rs.getLong(2), rs.getLong(3),
                    Math.max(0, rs.getDouble(4)), 0, 0, 0), OutboxRelay.MAX_RETRIES, OutboxRelay.MAX_RETRIES);
            Snapshot webhooks = jdbc.queryForObject("""
                    SELECT COUNT(*), COALESCE(EXTRACT(EPOCH FROM
                      (CURRENT_TIMESTAMP - MIN(COALESCE(next_attempt_at, created_at)))), 0)
                    FROM webhook_deliveries
                    WHERE status IN ('PENDING', 'RETRYING')
                      AND (next_attempt_at <= CURRENT_TIMESTAMP OR next_attempt_at IS NULL)
                    """, (rs, row) -> new Snapshot(0, 0, 0, 0, rs.getLong(1),
                    Math.max(0, rs.getDouble(2)), 0));
            Long disabled = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM webhook_configs WHERE status = 'FAILED'", Long.class);
            snapshot = new Snapshot(outbox.pending(), outbox.retryable(), outbox.exhausted(),
                    outbox.outboxAge(), webhooks.overdueWebhooks(), webhooks.webhookAge(), disabled);
            lastSuccess = registry.config().clock().wallTime() / 1000.0;
            healthy = true;
        } catch (RuntimeException failure) {
            // Do not log SQL, exception messages or connection details. Keep last valid sample.
            if (healthy || !attempted) log.warn("Baitly operational metrics refresh failed; previous sample retained");
            healthy = false;
        } finally {
            attempted = true;
        }
    }
}
