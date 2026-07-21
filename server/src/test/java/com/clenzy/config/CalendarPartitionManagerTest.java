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
import static org.mockito.ArgumentMatchers.startsWith;
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
        // Table partitionnée par défaut (check isCalendarDaysPartitioned, overload 2-arg) —
        // lenient car le test de skip le ré-stub à FALSE.
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class)))
            .thenReturn(Boolean.TRUE);
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
    void createFuturePartitions_tableNotPartitioned_skipsGracefully() {
        // Table plate (dev) : isCalendarDaysPartitioned() → false → no-op, aucun incident.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class)))
            .thenReturn(Boolean.FALSE);

        assertDoesNotThrow(() -> manager.createFuturePartitions());

        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Boolean.class), any(Object[].class));
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
        // partitionExists → FALSE partout (loop ET re-verification post-heal) : la
        // reparation ne remet rien en place → echec reellement non recuperable.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);
        doThrow(new RuntimeException("permission denied"))
            .when(jdbcTemplate).execute(anyString());

        // Should not propagate exception (le boot/scheduler ne plante pas)
        assertDoesNotThrow(() -> manager.createFuturePartitions());

        // 6 creations + 1 tentative d'auto-reparation (toutes en echec ici)
        verify(jdbcTemplate, times(7)).execute(anyString());
        // Echec non silencieux : compteur incremente (6 creations) + UN incident agrege
        assertEquals(6.0, failureCount());
        verify(incidentService, times(1)).openIncident(
            eq(IncidentType.SERVICE_DOWN),
            eq(CalendarPartitionManager.INCIDENT_SERVICE_NAME),
            anyString(),
            contains("calendar_days_"));
    }

    @Test
    void createFuturePartitions_selfHealRecovers_noIncidentOpened() {
        // Les creations rapides echouent (recouvrement DEFAULT), mais l'auto-reparation
        // reussit : la re-verification voit les partitions presentes → AUCUN incident.
        // partitionExists : FALSE pour les 6 checks de la boucle, TRUE ensuite (re-verif).
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(false, false, false, false, false, false, true);
        // Les CREATE rapides jettent (overlap DEFAULT) ; la repartition (DO $$ ...) passe.
        doThrow(new RuntimeException("would be violated by some row"))
            .when(jdbcTemplate).execute(startsWith("CREATE TABLE IF NOT EXISTS"));
        doNothing().when(jdbcTemplate).execute(contains("pg_advisory_xact_lock"));

        assertDoesNotThrow(() -> manager.createFuturePartitions());

        // La repartition a bien ete tentee...
        verify(jdbcTemplate, times(1)).execute(contains("pg_advisory_xact_lock"));
        // ...et comme la re-verification confirme les partitions, aucun incident.
        verifyNoInteractions(incidentService);
        // Le compteur reflete quand meme les 6 echecs de creation rapide.
        assertEquals(6.0, failureCount());
    }

    @Test
    void createFuturePartitions_queryFails_alertedAfterFailedHeal() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenThrow(new RuntimeException("DB down"));

        assertDoesNotThrow(() -> manager.createFuturePartitions());

        // Aucune creation rapide (le check jette avant), mais l'auto-reparation est tentee.
        verify(jdbcTemplate, times(1)).execute(anyString());
        assertEquals(6.0, failureCount());
        verify(incidentService, times(1)).openIncident(
            eq(IncidentType.SERVICE_DOWN),
            eq(CalendarPartitionManager.INCIDENT_SERVICE_NAME),
            anyString(),
            anyString());
    }

    @Test
    void catchUpOnBoot_tableNotPartitioned_isNoOp() {
        // Rattrapage au demarrage : sur table plate (dev), no-op complet.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class)))
            .thenReturn(Boolean.FALSE);

        assertDoesNotThrow(() -> manager.catchUpOnBoot());

        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Boolean.class), any(Object[].class));
        verify(jdbcTemplate, never()).execute(anyString());
        verifyNoInteractions(incidentService);
    }

    @Test
    void createFuturePartitions_populatesDefaultBacklogGauge() {
        // Tout existe deja → pas de creation, mais la jauge de backlog est rafraichie.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class)))
            .thenReturn(7L);

        manager.createFuturePartitions();

        assertEquals(7.0,
            meterRegistry.get("clenzy.calendar.partition.default.future_backlog").gauge().value());
    }

    // ── probeAndHeal (bouton « Retest » d'un incident) ────────────────────────

    @Test
    void probeAndHeal_tableNotPartitioned_returnsTrueWithoutTouchingDb() {
        // Table plate (dev) : aucune panne possible → sain, aucune reparation.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class)))
            .thenReturn(Boolean.FALSE);

        assertTrue(manager.probeAndHeal());

        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void probeAndHeal_allPartitionsExist_returnsTrueWithoutHealing() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.TRUE);

        assertTrue(manager.probeAndHeal());

        // Rien a reparer → pas de repartition.
        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void probeAndHeal_partitionMissingButHealFixes_returnsTrue() {
        // 1re verif : 1re partition manquante (short-circuit) → reparation → 2e verif : tout present.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(false, true, true, true, true, true, true);

        assertTrue(manager.probeAndHeal());

        verify(jdbcTemplate, times(1)).execute(contains("pg_advisory_xact_lock"));
    }

    @Test
    void probeAndHeal_partitionMissingAndHealDoesNotFix_returnsFalse() {
        // Partitions toujours absentes meme apres la tentative de reparation.
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);

        assertFalse(manager.probeAndHeal());

        verify(jdbcTemplate, times(1)).execute(contains("pg_advisory_xact_lock"));
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
