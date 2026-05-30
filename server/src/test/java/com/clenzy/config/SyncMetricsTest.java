package com.clenzy.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class SyncMetricsTest {

    private MeterRegistry registry;
    private SyncMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new SyncMetrics(registry);
    }

    @Test
    void getRegistry_returnsInjectedRegistry() {
        assertSame(registry, metrics.getRegistry());
    }

    @Test
    void recordSyncSuccess_incrementsCounterAndTimer() {
        metrics.recordSyncSuccess("AIRBNB", 100);

        Counter c = registry.find("pms.sync.success").tag("channel", "AIRBNB").counter();
        Timer t = registry.find("pms.sync.latency").tag("channel", "AIRBNB").timer();

        assertNotNull(c);
        assertEquals(1.0, c.count());
        assertNotNull(t);
        assertEquals(1, t.count());
    }

    @Test
    void recordSyncFailure_incrementsErrorCounter() {
        metrics.recordSyncFailure("BOOKING", "TimeoutException", 250);

        Counter c = registry.find("pms.sync.failure")
            .tag("channel", "BOOKING")
            .tag("error_type", "TimeoutException")
            .counter();

        assertNotNull(c);
        assertEquals(1.0, c.count());
    }

    @Test
    void recordSyncFailure_nullErrorType_defaultsToUnknown() {
        metrics.recordSyncFailure("VRBO", null, 50);

        Counter c = registry.find("pms.sync.failure")
            .tag("channel", "VRBO")
            .tag("error_type", "unknown")
            .counter();
        assertNotNull(c);
    }

    @Test
    void recordCalendarOperation_stopsTimer() {
        Timer.Sample sample = metrics.startTimer();

        metrics.recordCalendarOperation("book", sample);

        Timer t = registry.find("pms.calendar.update.latency").tag("operation", "book").timer();
        assertNotNull(t);
        assertEquals(1, t.count());
    }

    @Test
    void incrementConflictDetected_incrementsCounter() {
        metrics.incrementConflictDetected();
        metrics.incrementConflictDetected();

        Counter c = registry.find("pms.calendar.conflict.detected").counter();
        assertEquals(2.0, c.count());
    }

    @Test
    void incrementLockContention_incrementsCounter() {
        metrics.incrementLockContention();

        Counter c = registry.find("pms.calendar.lock.contention").counter();
        assertEquals(1.0, c.count());
    }

    @Test
    void incrementDoubleBookingPrevented_incrementsCounter() {
        metrics.incrementDoubleBookingPrevented();

        Counter c = registry.find("pms.reservation.double_booking.prevented").counter();
        assertEquals(1.0, c.count());
    }

    @Test
    void recordReservationCreation_stopsTimer() {
        Timer.Sample sample = metrics.startTimer();

        metrics.recordReservationCreation("MANUAL", sample);

        Timer t = registry.find("pms.reservation.creation.latency").tag("source", "MANUAL").timer();
        assertNotNull(t);
        assertEquals(1, t.count());
    }

    @Test
    void updateOutboxPending_updatesGauge() {
        metrics.updateOutboxPending(42);

        assertEquals(42.0, registry.find("pms.outbox.pending").gauge().value());
    }

    @Test
    void updateActiveSyncConnections_updatesGauge() {
        metrics.updateActiveSyncConnections(7);

        assertEquals(7.0, registry.find("pms.sync.connections.active").gauge().value());
    }

    @Test
    void incrementReconciliationRuns_incrementsCounter() {
        metrics.incrementReconciliationRuns();
        metrics.incrementReconciliationRuns();

        Counter c = registry.find("pms.reconciliation.runs").counter();
        assertEquals(2.0, c.count());
    }

    @Test
    void incrementReconciliationDiscrepancies_incrementsByCount() {
        metrics.incrementReconciliationDiscrepancies(5);

        Counter c = registry.find("pms.reconciliation.discrepancies").counter();
        assertEquals(5.0, c.count());
    }

    @Test
    void incrementReconciliationFixes_incrementsByCount() {
        metrics.incrementReconciliationFixes(3);

        Counter c = registry.find("pms.reconciliation.fixes").counter();
        assertEquals(3.0, c.count());
    }

    @Test
    void startTimer_returnsNonNullSample() {
        assertNotNull(metrics.startTimer());
    }

    @Test
    void multipleChannelSyncs_separateCounters() {
        metrics.recordSyncSuccess("AIRBNB", 50);
        metrics.recordSyncSuccess("BOOKING", 60);
        metrics.recordSyncSuccess("AIRBNB", 70);

        assertEquals(2.0, registry.find("pms.sync.success").tag("channel", "AIRBNB").counter().count());
        assertEquals(1.0, registry.find("pms.sync.success").tag("channel", "BOOKING").counter().count());
    }

    @Test
    void timerRecordsLatency() {
        metrics.recordSyncSuccess("AIRBNB", 250);

        Timer t = registry.find("pms.sync.latency").tag("channel", "AIRBNB").timer();
        assertEquals(250.0, t.totalTime(TimeUnit.MILLISECONDS), 0.1);
    }
}
