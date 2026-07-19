package com.clenzy.scheduler;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class KbIndexTuningSchedulerTest {

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
    }

    @Test
    void runOnce_disabled_returnsDisabled_noJdbcCall() {
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, false, false);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.DISABLED, outcome.status());
        verifyNoInteractions(jdbc);
    }

    @Test
    void runOnce_countFails_returnsError() {
        when(jdbc.queryForObject(anyString(), eq(Long.class)))
                .thenThrow(new RuntimeException("DB connection lost"));
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, false);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.ERROR, outcome.status());
        assertTrue(outcome.message().contains("count failed"));
    }

    @Test
    void runOnce_smallTable_keepsMinLists100() {
        // 50 chunks → sqrt(50) ~ 7, mais on borne a min 100
        stubCount(50L);
        stubIndexDef("CREATE INDEX idx ... WITH (lists='100')");
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, false);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        // 100 vs 100 → drift 0 → UP_TO_DATE
        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.UP_TO_DATE, outcome.status());
        assertEquals(100, outcome.optimalLists());
        assertEquals(100, outcome.currentLists());
    }

    @Test
    void runOnce_largeTableDriftExceedsThreshold_recommendsManualWhenAutoOff() {
        // 40 000 chunks → sqrt ~ 200, current = 100 → drift 100% > 50%
        stubCount(40_000L);
        stubIndexDef("CREATE INDEX idx ... WITH (lists='100')");
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, false);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.RECOMMENDATION, outcome.status());
        assertEquals(200, outcome.optimalLists());
        assertEquals(100, outcome.currentLists());
        // Pas de DROP/CREATE en mode RECOMMENDATION
        verify(jdbc, never()).execute(anyString());
    }

    @Test
    void runOnce_driftExceedsThreshold_appliedWhenAutoOn() {
        stubCount(40_000L);
        stubIndexDef("CREATE INDEX idx ... WITH (lists='100')");
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, true);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.APPLIED, outcome.status());
        ArgumentCaptor<String> sqlCap = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).execute(sqlCap.capture());
        assertTrue(sqlCap.getAllValues().get(0).toUpperCase().contains("DROP INDEX CONCURRENTLY"));
        assertTrue(sqlCap.getAllValues().get(1).toUpperCase().contains("CREATE INDEX CONCURRENTLY"));
        assertTrue(sqlCap.getAllValues().get(1).contains("lists = 200"));
    }

    @Test
    void runOnce_indexNotFound_returnsIndexNotFound() {
        stubCount(1000L);
        when(jdbc.queryForObject(eq("SELECT indexdef FROM pg_indexes WHERE indexname = ? LIMIT 1"),
                eq(String.class), any())).thenReturn(null);
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, true);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.INDEX_NOT_FOUND, outcome.status());
        verify(jdbc, never()).execute(anyString());
    }

    @Test
    void runOnce_indexDdlWithoutLists_returnsIndexNotFound() {
        stubCount(1000L);
        // DDL etrange : pas de "lists=N"
        stubIndexDef("CREATE INDEX idx ON kb_chunk USING gin (content)");
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, true);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.INDEX_NOT_FOUND, outcome.status());
    }

    @Test
    void runOnce_applyFails_returnsError() {
        stubCount(40_000L);
        stubIndexDef("CREATE INDEX idx ... WITH (lists='100')");
        doThrow(new RuntimeException("lock timeout"))
                .when(jdbc).execute(org.mockito.ArgumentMatchers.contains("DROP INDEX"));
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, true, true);

        KbIndexTuningScheduler.TuningOutcome outcome = scheduler.runOnce();

        assertEquals(KbIndexTuningScheduler.TuningOutcome.Status.ERROR, outcome.status());
        assertTrue(outcome.message().contains("apply failed"));
    }

    @Test
    void computeOptimalLists_followsSqrtFormula_withFloor100() {
        assertEquals(100, KbIndexTuningScheduler.computeOptimalLists(0));
        assertEquals(100, KbIndexTuningScheduler.computeOptimalLists(50));
        assertEquals(100, KbIndexTuningScheduler.computeOptimalLists(10_000));   // sqrt=100
        assertEquals(200, KbIndexTuningScheduler.computeOptimalLists(40_000));   // sqrt=200
        assertEquals(1000, KbIndexTuningScheduler.computeOptimalLists(1_000_000)); // sqrt=1000
    }

    @Test
    void runDaily_delegatesToRunOnce() {
        KbIndexTuningScheduler scheduler = new KbIndexTuningScheduler(jdbc, null, false, false);
        // disabled → 1 appel runOnce qui retourne disabled sans toucher JDBC
        scheduler.runDaily();
        verifyNoInteractions(jdbc);
    }

    private void stubCount(long n) {
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM kb_chunk WHERE embedding IS NOT NULL"),
                eq(Long.class))).thenReturn(n);
    }

    private void stubIndexDef(String ddl) {
        when(jdbc.queryForObject(eq("SELECT indexdef FROM pg_indexes WHERE indexname = ? LIMIT 1"),
                eq(String.class), any())).thenReturn(ddl);
    }
}
