package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.dto.kpi.KpiDtos.KpiHistoryDto;
import com.clenzy.dto.kpi.KpiDtos.KpiItemDto;
import com.clenzy.dto.kpi.KpiDtos.KpiSnapshotDto;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.clenzy.model.KpiSnapshot;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OutboxEvent;
import com.clenzy.model.ReconciliationRun;
import com.clenzy.repository.KpiSnapshotRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for KpiService covering all 12 KPI computations,
 * readiness score calculation, snapshot persistence, history retrieval,
 * and alert dispatch logic.
 *
 * Uses a real SimpleMeterRegistry for metrics (simpler than mocking the chain)
 * and Mockito mocks for all repository/service dependencies.
 */
@ExtendWith(MockitoExtension.class)
class KpiServiceTest {

    @Mock private SyncMetrics syncMetrics;
    @Mock private KpiSnapshotRepository kpiSnapshotRepository;
    @Mock private ReconciliationRunRepository reconciliationRunRepository;
    @Mock private OutboxEventRepository outboxEventRepository;
    @Mock private ChannelConnectionRepository connectionRepository;
    @Mock private ChannelSyncLogRepository syncLogRepository;
    @Mock private NotificationService notificationService;
    @Mock private ObjectMapper objectMapper;

    private SimpleMeterRegistry registry;
    private KpiService kpiService;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        lenient().when(syncMetrics.getRegistry()).thenReturn(registry);

        kpiService = new KpiService(
                syncMetrics,
                kpiSnapshotRepository,
                reconciliationRunRepository,
                outboxEventRepository,
                connectionRepository,
                syncLogRepository,
                notificationService,
                objectMapper
        );

        ReflectionTestUtils.setField(kpiService, "p1ResolutionMinutes", 0.0);
        ReflectionTestUtils.setField(kpiService, "testCoveragePct", 0.0);
    }

    // ── Helper: set up a "all green" baseline ────────────────────────────────

    /**
     * Registers metrics and stubs repositories so every KPI evaluates to OK.
     * Individual tests can then override the specific metric they want to test.
     */
    private void stubAllKpisOk() {
        // Uptime: 10000 total requests, 0 server errors => 100%
        Counter.builder("clenzy.api.request.total").register(registry).increment(10_000);
        // No error counter registered => 0 errors

        // Calendar latency: record a fast sync
        Timer.builder("pms.sync.latency")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
                .record(100, TimeUnit.MILLISECONDS);

        // Sync error rate: all success
        lenient().when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(1000L);
        lenient().when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(0L);

        // Inventory coherence: no reconciliation runs => defaults to 100%
        lenient().when(reconciliationRunRepository.findRecentPaged(any(PageRequest.class)))
                .thenReturn(Page.empty());

        // Double bookings: counter not registered => 0

        // API latency: record fast
        Timer.builder("clenzy.api.request.duration")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
                .record(50, TimeUnit.MILLISECONDS);

        // Sync availability: all active
        ChannelConnection conn = mock(ChannelConnection.class);
        lenient().when(connectionRepository.findAllCrossOrg()).thenReturn(List.of(conn, conn));
        lenient().when(connectionRepository.findAllActive()).thenReturn(List.of(conn, conn));

        // Outbox drain: no pending events
        lenient().when(outboxEventRepository.findPendingEvents()).thenReturn(Collections.emptyList());

        // Kafka lag: no gauge registered => 0
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. computeCurrentSnapshot — all KPIs OK
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class ComputeCurrentSnapshotTests {

        @Test
        void whenAllKpisOk_thenScoreIs100AndNoCriticalFailure() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertEquals(100.0, snapshot.readinessScore());
            assertFalse(snapshot.criticalFailed());
            assertEquals(12, snapshot.kpis().size());
            assertEquals("REALTIME", snapshot.source());
            assertNull(snapshot.id());

            // Verify all KPIs are OK
            for (KpiItemDto kpi : snapshot.kpis()) {
                assertEquals("OK", kpi.status(),
                        "Expected OK for KPI " + kpi.id() + " but got " + kpi.status());
            }
        }

        @Test
        void whenUptimeCritical_thenScoreIsZero() {
            stubAllKpisOk();

            // Override: 10000 total, 200 errors => 98% uptime (below 99.5 CRITICAL threshold)
            Counter.builder("clenzy.api.error.server").register(registry).increment(200);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertEquals(0.0, snapshot.readinessScore());
            assertTrue(snapshot.criticalFailed());

            KpiItemDto uptime = findKpi(snapshot.kpis(), "UPTIME");
            assertEquals("CRITICAL", uptime.status());
            assertTrue(uptime.critical());
        }

        @Test
        void whenSyncErrorRateWarning_thenScoreReflectsHalfWeight() {
            stubAllKpisOk();

            // Override sync error rate: 2% (between 1% OK and 3% WARN threshold)
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(980L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(20L);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertFalse(snapshot.criticalFailed());

            KpiItemDto syncErr = findKpi(snapshot.kpis(), "SYNC_ERROR_RATE");
            assertEquals("WARNING", syncErr.status());

            // Expected: all KPIs OK (weight=90) at 1.0 + SYNC_ERROR_RATE (weight=10) at 0.5
            // = (90*1.0 + 10*0.5) / 100 = 95/100 = 95.0
            assertEquals(95.0, snapshot.readinessScore());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. captureAndPersistSnapshot
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class CaptureAndPersistSnapshotTests {

        @Test
        void whenCalled_thenPersistsSnapshotAndReturnsDto() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(42L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(100.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            KpiSnapshotDto result = kpiService.captureAndPersistSnapshot("MANUAL");

            assertEquals(42L, result.id());
            assertEquals("MANUAL", result.source());
            assertEquals(100.0, result.readinessScore());
            assertFalse(result.criticalFailed());

            verify(kpiSnapshotRepository).save(any(KpiSnapshot.class));
        }

        @Test
        void whenCriticalFailure_thenSendsKpiCriticalFailureNotification() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            // Make uptime CRITICAL
            Counter.builder("clenzy.api.error.server").register(registry).increment(200);

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(1L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.ZERO);
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            kpiService.captureAndPersistSnapshot("MANUAL");

            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.KPI_CRITICAL_FAILURE),
                    anyString(),
                    contains("Uptime"),
                    eq("/admin/kpi")
            );
        }

        @Test
        void whenNonCriticalKpiCritical_thenSendsThresholdBreachNotification() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            // Make sync error rate CRITICAL: 5% (above 3% threshold)
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(950L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(50L);

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(2L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(90.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            kpiService.captureAndPersistSnapshot("SCHEDULED");

            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.KPI_THRESHOLD_BREACH),
                    anyString(),
                    anyString(),
                    eq("/admin/kpi")
            );
            // Should NOT send KPI_CRITICAL_FAILURE since no critical KPI failed
            verify(notificationService, never()).notifyAdminsAndManagers(
                    eq(NotificationKey.KPI_CRITICAL_FAILURE),
                    anyString(),
                    anyString(),
                    anyString()
            );
        }

        @Test
        void whenSerializationFails_thenHandlesGracefully() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any()))
                    .thenThrow(new JsonProcessingException("boom") {});

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(3L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(100.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            // Should not throw
            KpiSnapshotDto result = kpiService.captureAndPersistSnapshot("MANUAL");

            assertNotNull(result);
            assertEquals(3L, result.id());
            verify(kpiSnapshotRepository).save(argThat(snap ->
                    snap.getMetricsDetail() == null));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. getHistory
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class GetHistoryTests {

        @Test
        void whenSnapshotsExist_thenReturnsMappedPoints() {
            KpiSnapshot s1 = buildSnapshot(1L, 95.5, false);
            KpiSnapshot s2 = buildSnapshot(2L, 100.0, false);

            when(kpiSnapshotRepository.findByDateRange(any(LocalDateTime.class), any(LocalDateTime.class)))
                    .thenReturn(List.of(s1, s2));

            KpiHistoryDto history = kpiService.getHistory(24);

            assertEquals(2, history.totalPoints());
            assertEquals(2, history.points().size());
            assertEquals(95.5, history.points().get(0).readinessScore());
            assertEquals(100.0, history.points().get(1).readinessScore());
            assertNotNull(history.from());
            assertNotNull(history.to());
        }

        @Test
        void whenNoSnapshots_thenReturnsEmptyPointsList() {
            when(kpiSnapshotRepository.findByDateRange(any(LocalDateTime.class), any(LocalDateTime.class)))
                    .thenReturn(Collections.emptyList());

            KpiHistoryDto history = kpiService.getHistory(48);

            assertEquals(0, history.totalPoints());
            assertTrue(history.points().isEmpty());
        }

        private KpiSnapshot buildSnapshot(Long id, double score, boolean criticalFailed) {
            KpiSnapshot s = new KpiSnapshot();
            s.setId(id);
            s.setCapturedAt(LocalDateTime.now());
            s.setReadinessScore(BigDecimal.valueOf(score));
            s.setCriticalFailed(criticalFailed);
            s.setUptimePct(BigDecimal.valueOf(99.99));
            s.setSyncErrorRatePct(BigDecimal.valueOf(0.1));
            s.setApiLatencyP95Ms(BigDecimal.valueOf(50));
            s.setCalendarLatencyP95Ms(BigDecimal.valueOf(200));
            s.setInventoryCoherencePct(BigDecimal.valueOf(99.9));
            s.setDoubleBookings(0);
            s.setSyncAvailabilityPct(BigDecimal.valueOf(100));
            s.setOutboxDrainTimeMs(BigDecimal.valueOf(0));
            s.setReconciliationDivergencePct(BigDecimal.valueOf(0.1));
            return s;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Individual KPI computation tests
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class ComputeUptimeTests {

        @Test
        void when100PctUptime_thenStatusIsOk() {
            stubAllKpisOk();
            // 10000 requests, 0 errors already set by stubAllKpisOk

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto uptime = findKpi(snapshot.kpis(), "UPTIME");

            assertEquals("OK", uptime.status());
            assertEquals(100.0, uptime.rawValue());
            assertTrue(uptime.critical());
            assertEquals(15, uptime.weight());
        }

        @Test
        void whenBelow995Pct_thenStatusIsCritical() {
            stubAllKpisOk();
            // 10000 requests + 200 errors => (10000-200)/10000 = 98% < 99.5%
            Counter.builder("clenzy.api.error.server").register(registry).increment(200);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto uptime = findKpi(snapshot.kpis(), "UPTIME");

            assertEquals("CRITICAL", uptime.status());
            assertTrue(uptime.rawValue() < 99.5);
        }

        @Test
        void whenBetween995And999_thenStatusIsWarning() {
            stubAllKpisOk();
            // 10000 requests + 8 errors => (10000-8)/10000 = 99.92% — but wait,
            // we need between 99.5 and 99.9
            // 10000 requests, 20 errors => 99.8% (between 99.5 WARN and 99.9 OK)
            Counter.builder("clenzy.api.error.server").register(registry).increment(20);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto uptime = findKpi(snapshot.kpis(), "UPTIME");

            assertEquals("WARNING", uptime.status());
            double expectedPct = (10000.0 - 20.0) / 10000.0 * 100.0;
            assertEquals(expectedPct, uptime.rawValue(), 0.001);
        }
    }

    @Nested
    class ComputeSyncErrorRateTests {

        @Test
        void whenZeroErrors_thenStatusIsOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto syncErr = findKpi(snapshot.kpis(), "SYNC_ERROR_RATE");

            assertEquals("OK", syncErr.status());
            assertEquals(0.0, syncErr.rawValue());
        }

        @Test
        void whenAbove3Pct_thenStatusIsCritical() {
            stubAllKpisOk();
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(900L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(100L);
            // 100 / 1000 = 10% > 3%

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto syncErr = findKpi(snapshot.kpis(), "SYNC_ERROR_RATE");

            assertEquals("CRITICAL", syncErr.status());
            assertEquals(10.0, syncErr.rawValue(), 0.01);
        }

        @Test
        void whenBetween1And3Pct_thenStatusIsWarning() {
            stubAllKpisOk();
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(980L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(20L);
            // 20 / 1000 = 2% (between 1% and 3%)

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto syncErr = findKpi(snapshot.kpis(), "SYNC_ERROR_RATE");

            assertEquals("WARNING", syncErr.status());
        }

        @Test
        void whenNoSyncsAtAll_thenZeroErrorRate() {
            stubAllKpisOk();
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(0L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(0L);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto syncErr = findKpi(snapshot.kpis(), "SYNC_ERROR_RATE");

            assertEquals("OK", syncErr.status());
            assertEquals(0.0, syncErr.rawValue());
        }
    }

    @Nested
    class ComputeInventoryCoherenceTests {

        @Test
        void whenNoRuns_thenCoherenceIs100Pct() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto invCoh = findKpi(snapshot.kpis(), "INVENTORY_COHERENCE");

            assertEquals("OK", invCoh.status());
            assertEquals(100.0, invCoh.rawValue());
        }

        @Test
        void whenRunsWithDiscrepancies_thenCoherenceReflectsRatio() {
            stubAllKpisOk();

            ReconciliationRun run = new ReconciliationRun();
            run.setPmsDaysChecked(100);
            run.setDiscrepanciesFound(5);
            run.setDivergencePct(BigDecimal.valueOf(0.1));
            Page<ReconciliationRun> page = new PageImpl<>(List.of(run));
            when(reconciliationRunRepository.findRecentPaged(any(PageRequest.class))).thenReturn(page);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto invCoh = findKpi(snapshot.kpis(), "INVENTORY_COHERENCE");

            // (1 - 5/100) * 100 = 95% < 98% => CRITICAL
            assertEquals("CRITICAL", invCoh.status());
            assertEquals(95.0, invCoh.rawValue(), 0.01);
        }
    }

    @Nested
    class ComputeDoubleBookingsTests {

        @Test
        void whenSystemWorking_thenAlwaysZeroAndOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto db = findKpi(snapshot.kpis(), "DOUBLE_BOOKINGS");

            assertEquals("OK", db.status());
            assertEquals(0.0, db.rawValue());
            assertTrue(db.critical());
            assertEquals(15, db.weight());
        }
    }

    @Nested
    class ComputeP1ResolutionTests {

        @Test
        void whenZeroMinutes_thenNAandOk() {
            stubAllKpisOk();
            // p1ResolutionMinutes is already 0 from setUp

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto p1 = findKpi(snapshot.kpis(), "P1_RESOLUTION");

            assertEquals("OK", p1.status());
            assertEquals("N/A", p1.value());
            assertEquals(0.0, p1.rawValue());
        }

        @Test
        void whenUnder60Min_thenOk() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "p1ResolutionMinutes", 45.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto p1 = findKpi(snapshot.kpis(), "P1_RESOLUTION");

            assertEquals("OK", p1.status());
            assertEquals("45min", p1.value());
        }

        @Test
        void whenBetween60And120_thenWarning() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "p1ResolutionMinutes", 90.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto p1 = findKpi(snapshot.kpis(), "P1_RESOLUTION");

            assertEquals("WARNING", p1.status());
        }

        @Test
        void whenAbove120_thenCritical() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "p1ResolutionMinutes", 150.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto p1 = findKpi(snapshot.kpis(), "P1_RESOLUTION");

            assertEquals("CRITICAL", p1.status());
        }
    }

    @Nested
    class ComputeTestCoverageTests {

        @Test
        void whenZero_thenNAandOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto tc = findKpi(snapshot.kpis(), "TEST_COVERAGE");

            assertEquals("OK", tc.status());
            assertEquals("N/A", tc.value());
        }

        @Test
        void whenAbove90_thenOk() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "testCoveragePct", 92.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto tc = findKpi(snapshot.kpis(), "TEST_COVERAGE");

            assertEquals("OK", tc.status());
        }

        @Test
        void whenBetween80And90_thenWarning() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "testCoveragePct", 85.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto tc = findKpi(snapshot.kpis(), "TEST_COVERAGE");

            assertEquals("WARNING", tc.status());
        }

        @Test
        void whenBelow80_thenCritical() {
            stubAllKpisOk();
            ReflectionTestUtils.setField(kpiService, "testCoveragePct", 70.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto tc = findKpi(snapshot.kpis(), "TEST_COVERAGE");

            assertEquals("CRITICAL", tc.status());
        }
    }

    @Nested
    class ComputeSyncAvailabilityTests {

        @Test
        void whenAllActive_thenOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto sa = findKpi(snapshot.kpis(), "SYNC_AVAILABILITY");

            assertEquals("OK", sa.status());
            assertEquals(100.0, sa.rawValue());
        }

        @Test
        void whenNoConnections_thenDefaultsTo100Pct() {
            stubAllKpisOk();
            when(connectionRepository.findAllCrossOrg()).thenReturn(Collections.emptyList());
            when(connectionRepository.findAllActive()).thenReturn(Collections.emptyList());

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto sa = findKpi(snapshot.kpis(), "SYNC_AVAILABILITY");

            assertEquals("OK", sa.status());
            assertEquals(100.0, sa.rawValue());
        }
    }

    @Nested
    class ComputeOutboxDrainTests {

        @Test
        void whenNoPendingEvents_thenOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto od = findKpi(snapshot.kpis(), "OUTBOX_DRAIN");

            assertEquals("OK", od.status());
            assertEquals(0.0, od.rawValue());
        }

        @Test
        void whenOldPendingEvent_thenReflectsDrainTime() {
            stubAllKpisOk();

            OutboxEvent oldEvent = new OutboxEvent();
            oldEvent.setCreatedAt(LocalDateTime.now().minusSeconds(35));
            when(outboxEventRepository.findPendingEvents()).thenReturn(List.of(oldEvent));

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto od = findKpi(snapshot.kpis(), "OUTBOX_DRAIN");

            // 35 seconds = 35000ms, which is > 30000 (WARN) => CRITICAL
            assertEquals("CRITICAL", od.status());
            assertTrue(od.rawValue() > 30_000);
        }
    }

    @Nested
    class ComputeKafkaLagTests {

        @Test
        void whenNoGauge_thenZeroLagOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto kl = findKpi(snapshot.kpis(), "KAFKA_LAG");

            assertEquals("OK", kl.status());
            assertEquals(0.0, kl.rawValue());
        }
    }

    @Nested
    class ComputeReconDivergenceTests {

        @Test
        void whenNoRuns_thenZeroDivergenceOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto rd = findKpi(snapshot.kpis(), "RECON_DIVERGENCE");

            assertEquals("OK", rd.status());
            assertEquals(0.0, rd.rawValue());
        }

        @Test
        void whenHighDivergence_thenCritical() {
            stubAllKpisOk();

            ReconciliationRun run = new ReconciliationRun();
            run.setPmsDaysChecked(100);
            run.setDiscrepanciesFound(5);
            run.setDivergencePct(BigDecimal.valueOf(3.5));
            Page<ReconciliationRun> page = new PageImpl<>(List.of(run));
            when(reconciliationRunRepository.findRecentPaged(any(PageRequest.class))).thenReturn(page);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto rd = findKpi(snapshot.kpis(), "RECON_DIVERGENCE");

            assertEquals("CRITICAL", rd.status());
            assertEquals(3.5, rd.rawValue(), 0.01);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. Readiness score calculation
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class ReadinessScoreTests {

        @Test
        void whenAllOk_thenScoreIs100() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertEquals(100.0, snapshot.readinessScore());
        }

        @Test
        void whenCriticalFailed_thenScoreIsZero() {
            stubAllKpisOk();
            Counter.builder("clenzy.api.error.server").register(registry).increment(200);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertEquals(0.0, snapshot.readinessScore());
            assertTrue(snapshot.criticalFailed());
        }

        @Test
        void whenMixedOkAndWarning_thenWeightedAverage() {
            stubAllKpisOk();

            // P1 resolution WARNING (weight 5): 90 min, between 60 and 120
            ReflectionTestUtils.setField(kpiService, "p1ResolutionMinutes", 90.0);
            // Test coverage WARNING (weight 4): 85%, between 80 and 90
            ReflectionTestUtils.setField(kpiService, "testCoveragePct", 85.0);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertFalse(snapshot.criticalFailed());

            // OK weight = 100 - 5 - 4 = 91 at 1.0 = 91
            // WARNING weight = 5 + 4 = 9 at 0.5 = 4.5
            // Total = 95.5 / 100 = 95.5%
            assertEquals(95.5, snapshot.readinessScore());
        }

        @Test
        void whenNonCriticalKpiCritical_thenScoreNotZeroButReduced() {
            stubAllKpisOk();

            // Sync error rate CRITICAL (weight 10): 5% > 3%
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(950L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(50L);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            assertFalse(snapshot.criticalFailed());
            // All OK (weight 90) at 1.0 + SYNC_ERROR_RATE (weight 10) at 0.0
            // = 90 / 100 = 90.0
            assertEquals(90.0, snapshot.readinessScore());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. captureScheduledSnapshot
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class CaptureScheduledSnapshotTests {

        @Test
        void whenScheduledCapture_thenCallsCaptureWithScheduledSource() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(10L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(100.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            kpiService.captureScheduledSnapshot();

            ArgumentCaptor<KpiSnapshot> captor = ArgumentCaptor.forClass(KpiSnapshot.class);
            verify(kpiSnapshotRepository).save(captor.capture());
            assertEquals("SCHEDULED", captor.getValue().getSource());
        }

        @Test
        void whenCaptureThrows_thenDoesNotPropagate() {
            when(syncMetrics.getRegistry()).thenThrow(new RuntimeException("metrics unavailable"));

            // Should not throw
            assertDoesNotThrow(() -> kpiService.captureScheduledSnapshot());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. Snapshot field population
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class SnapshotFieldPopulationTests {

        @Test
        void whenPersisted_thenSnapshotFieldsArePopulated() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[...]");

            ArgumentCaptor<KpiSnapshot> captor = ArgumentCaptor.forClass(KpiSnapshot.class);
            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(99L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(100.0));
            when(kpiSnapshotRepository.save(captor.capture())).thenReturn(savedEntity);

            kpiService.captureAndPersistSnapshot("STARTUP");

            KpiSnapshot captured = captor.getValue();
            assertNotNull(captured.getUptimePct());
            assertNotNull(captured.getSyncErrorRatePct());
            assertNotNull(captured.getInventoryCoherencePct());
            assertEquals(0, captured.getDoubleBookings());
            assertNotNull(captured.getApiLatencyP95Ms());
            assertNotNull(captured.getSyncAvailabilityPct());
            assertNotNull(captured.getOutboxDrainTimeMs());
            assertNotNull(captured.getReconciliationDivergencePct());
            assertEquals("[...]", captured.getMetricsDetail());
            assertEquals("STARTUP", captured.getSource());
            assertFalse(captured.isCriticalFailed());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. Calendar latency computation
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class ComputeCalendarLatencyTests {

        @Test
        void whenNoTimer_thenZeroMsOk() {
            stubAllKpisOk();
            // The timer is registered by stubAllKpisOk with a fast value,
            // so override with a fresh registry that has no timer
            SimpleMeterRegistry emptyRegistry = new SimpleMeterRegistry();
            Counter.builder("clenzy.api.request.total").register(emptyRegistry).increment(10_000);
            Timer.builder("clenzy.api.request.duration")
                    .publishPercentiles(0.5, 0.95, 0.99)
                    .register(emptyRegistry)
                    .record(50, TimeUnit.MILLISECONDS);
            when(syncMetrics.getRegistry()).thenReturn(emptyRegistry);

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto cl = findKpi(snapshot.kpis(), "CALENDAR_LATENCY_P95");

            assertEquals("OK", cl.status());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. API latency computation
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class ComputeApiLatencyTests {

        @Test
        void whenFastApi_thenOk() {
            stubAllKpisOk();

            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            KpiItemDto al = findKpi(snapshot.kpis(), "API_LATENCY_P95");

            assertEquals("OK", al.status());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. Alert dispatch — edge cases
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    class AlertEdgeCaseTests {

        @Test
        void whenAllOk_thenNoNotificationSent() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(5L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(100.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            kpiService.captureAndPersistSnapshot("MANUAL");

            verify(notificationService, never()).notifyAdminsAndManagers(
                    any(NotificationKey.class), anyString(), anyString(), anyString());
        }

        @Test
        void whenNotificationThrows_thenDoesNotPropagate() throws Exception {
            stubAllKpisOk();
            when(objectMapper.writeValueAsString(any())).thenReturn("[]");

            // Make a non-critical KPI CRITICAL to trigger alert
            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(900L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(100L);

            doThrow(new RuntimeException("notification error"))
                    .when(notificationService).notifyAdminsAndManagers(
                            any(NotificationKey.class), anyString(), anyString(), anyString());

            KpiSnapshot savedEntity = new KpiSnapshot();
            savedEntity.setId(6L);
            savedEntity.setCapturedAt(LocalDateTime.now());
            savedEntity.setReadinessScore(BigDecimal.valueOf(90.0));
            when(kpiSnapshotRepository.save(any(KpiSnapshot.class))).thenReturn(savedEntity);

            // Should not throw even if notification fails
            assertDoesNotThrow(() -> kpiService.captureAndPersistSnapshot("MANUAL"));
        }
    }

    // ── Utility ──────────────────────────────────────────────────────────────

    private static KpiItemDto findKpi(List<KpiItemDto> kpis, String id) {
        return kpis.stream()
                .filter(k -> id.equals(k.id()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("KPI not found: " + id));
    }
}
