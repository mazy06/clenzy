package com.clenzy.config;

import com.clenzy.model.Incident.IncidentType;
import com.clenzy.service.IncidentService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CalendarPartitionManagerTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private IncidentService incidentService;

    private SimpleMeterRegistry meterRegistry;
    private CalendarPartitionManager manager;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        manager = new CalendarPartitionManager(jdbcTemplate, incidentService, meterRegistry);
    }

    private double failureCount() {
        return meterRegistry.counter("clenzy.calendar.partition.creation.failures").count();
    }

    @Test
    void createFuturePartitions_allPartitionsAlreadyExist_executesNothing() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.TRUE);

        manager.createFuturePartitions();

        // 6 checks via queryForObject, no execute since all exist
        verify(jdbcTemplate, times(6))
            .queryForObject(anyString(), eq(Boolean.class), any(Object[].class));
        verify(jdbcTemplate, never()).execute(anyString());
        verifyNoInteractions(incidentService);
        assertEquals(0.0, failureCount());
    }

    @Test
    void createFuturePartitions_partitionMissing_createsViaExecuteWithIfNotExists() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);

        manager.createFuturePartitions();

        // 6 future months → 6 creates
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, times(6)).execute(sqlCaptor.capture());
        for (String sql : sqlCaptor.getAllValues()) {
            // IF NOT EXISTS supprime la course check-then-act (Z1-BUGS-10)
            assertTrue(sql.startsWith("CREATE TABLE IF NOT EXISTS calendar_days_"));
            assertTrue(sql.contains("PARTITION OF calendar_days FOR VALUES FROM"));
        }
        verifyNoInteractions(incidentService);
        assertEquals(0.0, failureCount());
    }

    @Test
    void createFuturePartitions_nullExistsResult_treatedAsCreate() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(null);

        manager.createFuturePartitions();

        verify(jdbcTemplate, times(6)).execute(anyString());
    }

    @Test
    void createFuturePartitions_executeFails_continuesAndOpensSingleIncident() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);
        doThrow(new RuntimeException("permission denied"))
            .when(jdbcTemplate).execute(anyString());

        // Should not propagate exception (le boot/scheduler ne plante pas)
        assertDoesNotThrow(() -> manager.createFuturePartitions());

        // 6 attempts even though all fail
        verify(jdbcTemplate, times(6)).execute(anyString());
        // Echec non silencieux : compteur incremente + UN incident agrege
        assertEquals(6.0, failureCount());
        verify(incidentService, times(1)).openIncident(
            eq(IncidentType.SERVICE_DOWN),
            eq(CalendarPartitionManager.INCIDENT_SERVICE_NAME),
            anyString(),
            contains("calendar_days_"));
    }

    @Test
    void createFuturePartitions_queryFails_alertedPerIteration() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenThrow(new RuntimeException("DB down"));

        assertDoesNotThrow(() -> manager.createFuturePartitions());

        verify(jdbcTemplate, never()).execute(anyString());
        assertEquals(6.0, failureCount());
        verify(incidentService, times(1)).openIncident(
            eq(IncidentType.SERVICE_DOWN),
            eq(CalendarPartitionManager.INCIDENT_SERVICE_NAME),
            anyString(),
            anyString());
    }

    @Test
    void createFuturePartitions_incidentServiceThrows_noPropagation() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);
        doThrow(new RuntimeException("fail"))
            .when(jdbcTemplate).execute(anyString());
        when(incidentService.openIncident(any(), anyString(), anyString(), anyString()))
            .thenThrow(new IllegalStateException("notification down"));

        // L'alerte est best-effort : son echec ne doit pas remonter
        assertDoesNotThrow(() -> manager.createFuturePartitions());
    }
}
