package com.clenzy.service.retention;

import com.clenzy.service.AuditLogService;
import com.clenzy.service.retention.RetentionPurgeService.PurgeResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du moteur de purge de retention.
 *
 * <p>On mocke {@link PurgeSource} (le « quoi purger ») et on injecte un {@link Clock} fixe pour
 * verifier le cutoff de maniere deterministe. Invariants verifies : inerte si desactive ; dry-run
 * par defaut (countExpired seul, jamais deleteExpiredBatch) ; en mode reel, boucle de batch
 * jusqu'a epuisement avec cutoff = now - retentionDays ; no-op explicite sur cible inconnue / pas
 * de source / retention non configuree ; garde-fou anti-boucle.</p>
 */
@ExtendWith(MockitoExtension.class)
class RetentionPurgeServiceTest {

    /** Instant fixe pour un cutoff deterministe : 2026-06-26T00:00:00Z. */
    private static final Instant NOW = Instant.parse("2026-06-26T00:00:00Z");
    private static final Clock FIXED_CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static final String TARGET = "police-records";
    private static final int RETENTION_DAYS = 180;
    /** Cutoff attendu : NOW - 180 jours. */
    private static final Instant EXPECTED_CUTOFF = NOW.minus(Duration.ofDays(RETENTION_DAYS));

    @Mock private PurgeSource source;
    @Mock private AuditLogService auditLogService;
    @Mock private ObjectProvider<AuditLogService> auditProvider;

    private RetentionPurgeProperties.Target target() {
        return new RetentionPurgeProperties.Target(TARGET, "Fiche de police", RETENTION_DAYS,
                "FR CESEDA R814-3 (purge a 6 mois)");
    }

    private RetentionPurgeProperties props(boolean enabled, Boolean dryRunDefault,
                                           RetentionPurgeProperties.Target... targets) {
        return new RetentionPurgeProperties(enabled, false, dryRunDefault, 500, List.of(targets));
    }

    private RetentionPurgeService service(RetentionPurgeProperties props, List<PurgeSource> sources) {
        return new RetentionPurgeService(props, FIXED_CLOCK, auditProvider, sources);
    }

    @Nested
    @DisplayName("desactive par defaut (inerte)")
    class Disabled {

        @Test
        @DisplayName("enabled=false -> no-op : ni comptage ni suppression sur la PurgeSource")
        void disabledIsNoop() {
            // targetName() est appele a la construction (indexation des sources) ; legitime.
            when(source.targetName()).thenReturn(TARGET);
            // Source presente mais ne doit jamais etre LUE/PURGEE quand desactive.
            final RetentionPurgeService svc = service(props(false, true, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, null);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("purge-disabled");
            assertThat(result.deleted()).isZero();
            verify(source, never()).countExpired(any());
            verify(source, never()).deleteExpiredBatch(any(), anyInt());
            verifyNoInteractions(auditProvider);
        }
    }

    @Nested
    @DisplayName("dry-run (defaut) : comptage seul")
    class DryRun {

        @Test
        @DisplayName("enabled + dryRun par defaut (true) -> countExpired seul, deleteExpiredBatch JAMAIS, deleted=0")
        void defaultDryRunOnlyCounts() {
            when(source.targetName()).thenReturn(TARGET);
            when(source.countExpired(EXPECTED_CUTOFF)).thenReturn(42L);

            // dryRunDefault=true ET aucune surcharge -> dry-run.
            final RetentionPurgeService svc = service(props(true, true, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, null);

            assertThat(result.executed()).isTrue();
            assertThat(result.dryRun()).isTrue();
            assertThat(result.reason()).isEqualTo("dry-run");
            assertThat(result.candidates()).isEqualTo(42L);
            assertThat(result.deleted()).isZero();

            verify(source).countExpired(EXPECTED_CUTOFF);
            verify(source, never()).deleteExpiredBatch(any(), anyInt());
            // Aucun audit en dry-run (aucune suppression).
            verifyNoInteractions(auditProvider);
        }

        @Test
        @DisplayName("dryRunOverride=true surclasse un defaut false -> comptage seul")
        void explicitDryRunOverridesDefaultFalse() {
            when(source.targetName()).thenReturn(TARGET);
            when(source.countExpired(EXPECTED_CUTOFF)).thenReturn(7L);

            // Defaut = suppression reelle, mais l'override true force le dry-run.
            final RetentionPurgeService svc = service(props(true, false, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, true);

            assertThat(result.dryRun()).isTrue();
            assertThat(result.deleted()).isZero();
            verify(source, never()).deleteExpiredBatch(any(), anyInt());
        }
    }

    @Nested
    @DisplayName("reel (dryRun=false) : suppression bornee")
    class RealPurge {

        @Test
        @DisplayName("dryRun=false -> deleteExpiredBatch en boucle jusqu'a 0, deleted accumule, cutoff verifie")
        void realPurgeLoopsUntilEmpty() {
            when(source.targetName()).thenReturn(TARGET);
            when(source.countExpired(EXPECTED_CUTOFF)).thenReturn(1200L);
            // 500 (plein) -> 500 (plein) -> 200 (partiel) -> stop sur batch partiel.
            when(source.deleteExpiredBatch(eq(EXPECTED_CUTOFF), eq(500)))
                    .thenReturn(500, 500, 200);
            when(auditProvider.getIfAvailable()).thenReturn(auditLogService);

            final RetentionPurgeService svc = service(props(true, true, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, false);

            assertThat(result.executed()).isTrue();
            assertThat(result.dryRun()).isFalse();
            assertThat(result.reason()).isEqualTo("ok");
            assertThat(result.candidates()).isEqualTo(1200L);
            assertThat(result.deleted()).isEqualTo(1200L);

            // 3 batches : 500 + 500 + 200 (le 3e est partiel -> arret sans 4e appel).
            final ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
            verify(source, times(3)).deleteExpiredBatch(cutoffCaptor.capture(), eq(500));
            assertThat(cutoffCaptor.getAllValues()).containsOnly(EXPECTED_CUTOFF);

            // Audit obligatoire d'un run reel.
            verify(auditLogService, atLeastOnce()).logAction(
                    any(), eq("RetentionPurge"), eq(TARGET), any(), any(), any(), any());
        }

        @Test
        @DisplayName("dryRun=false + 0 candidat -> aucun delete (1er batch renvoie 0), deleted=0")
        void realPurgeNothingToDelete() {
            when(source.targetName()).thenReturn(TARGET);
            when(source.countExpired(EXPECTED_CUTOFF)).thenReturn(0L);
            when(source.deleteExpiredBatch(EXPECTED_CUTOFF, 500)).thenReturn(0);
            when(auditProvider.getIfAvailable()).thenReturn(auditLogService);

            final RetentionPurgeService svc = service(props(true, true, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, false);

            assertThat(result.deleted()).isZero();
            verify(source, times(1)).deleteExpiredBatch(EXPECTED_CUTOFF, 500);
        }
    }

    @Nested
    @DisplayName("garde-fous (no-op explicite)")
    class Guards {

        @Test
        @DisplayName("cible inconnue -> no-op (unknown-target), source jamais touchee")
        void unknownTargetIsNoop() {
            when(source.targetName()).thenReturn(TARGET);
            final RetentionPurgeService svc = service(props(true, true, target()), List.of(source));

            final PurgeResult result = svc.purge("does-not-exist", false);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("unknown-target");
            verify(source, never()).countExpired(any());
            verify(source, never()).deleteExpiredBatch(any(), anyInt());
        }

        @Test
        @DisplayName("aucune source enregistree pour la cible -> no-op (no-source-registered)")
        void noSourceRegisteredIsNoop() {
            // Cible configuree mais AUCUNE PurgeSource fournie (cas par defaut de la phase).
            final RetentionPurgeService svc = service(props(true, true, target()), List.of());

            final PurgeResult result = svc.purge(TARGET, false);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("no-source-registered");
        }

        @Test
        @DisplayName("retentionDays null -> no-op (retention-not-configured), aucune lecture/suppression")
        void nullRetentionIsNoop() {
            when(source.targetName()).thenReturn(TARGET);
            final RetentionPurgeProperties.Target noRetention =
                    new RetentionPurgeProperties.Target(TARGET, "Sans retention", null, "n/a");
            final RetentionPurgeService svc = service(props(true, true, noRetention), List.of(source));

            final PurgeResult result = svc.purge(TARGET, false);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("retention-not-configured");
            verify(source, never()).countExpired(any());
            verify(source, never()).deleteExpiredBatch(any(), anyInt());
        }

        @Test
        @DisplayName("retentionDays <= 0 -> no-op (retention-not-configured)")
        void nonPositiveRetentionIsNoop() {
            when(source.targetName()).thenReturn(TARGET);
            final RetentionPurgeProperties.Target zeroRetention =
                    new RetentionPurgeProperties.Target(TARGET, "Retention 0", 0, "n/a");
            final RetentionPurgeService svc = service(props(true, true, zeroRetention), List.of(source));

            final PurgeResult result = svc.purge(TARGET, false);

            assertThat(result.reason()).isEqualTo("retention-not-configured");
        }
    }

    @Nested
    @DisplayName("anti-boucle (suppression bornee)")
    class AntiLoop {

        @Test
        @DisplayName("deleteExpiredBatch renvoie toujours batchSize -> la boucle s'arrete au garde-fou MAX_BATCHES")
        void infiniteFullBatchesStopAtGuard() {
            when(source.targetName()).thenReturn(TARGET);
            when(source.countExpired(EXPECTED_CUTOFF)).thenReturn(Long.MAX_VALUE);
            // Pathologique : chaque batch renvoie le plein (500) -> jamais de batch partiel.
            when(source.deleteExpiredBatch(EXPECTED_CUTOFF, 500)).thenReturn(500);
            when(auditProvider.getIfAvailable()).thenReturn(auditLogService);

            final RetentionPurgeService svc = service(props(true, true, target()), List.of(source));

            final PurgeResult result = svc.purge(TARGET, false);

            // Le run se termine (pas de boucle infinie) ; borne exacte = MAX_BATCHES.
            assertThat(result.executed()).isTrue();
            verify(source, times(RetentionPurgeService.MAX_BATCHES))
                    .deleteExpiredBatch(EXPECTED_CUTOFF, 500);
            assertThat(result.deleted())
                    .isEqualTo((long) RetentionPurgeService.MAX_BATCHES * 500);
        }
    }
}
