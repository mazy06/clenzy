package com.clenzy.scheduler;

import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.agent.supervision.SupervisionConfigService;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import com.clenzy.service.agent.supervision.SupervisionScanRotation;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.service.ai.AutonomyBudgetService.Decision;
import com.clenzy.service.ai.AutonomyBudgetService.Outcome;
import com.clenzy.service.ai.AutonomyRunScope;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Deux verdicts distincts sur ce balayage :
 *
 * <p>X8-b : le scan LLM autonome est un comportement premium gated par
 * AutonomyRunScope. ALLOWED → scan LLM ; CAPPED_NOTIFY_ONLY / DISABLED →
 * heuristiques deterministes seules (0 LLM) ; CAPPED_PAUSE → rien.</p>
 *
 * <p>Complement periodique : un logement ACTIF dont c'est le tour est passe en
 * revue meme si aucun evenement ne l'a touche — sans quoi un logement calme
 * n'etait jamais vu.</p>
 */
@ExtendWith(MockitoExtension.class)
class SupervisionAutonomousScannerTest {

    private static final Long ORG_ID = 7L;
    private static final Long PROPERTY_ID = 42L;
    private static final int PERIODIC_INTERVAL_MS = 21_600_000;
    private static final int MAX_PERIODIC_PER_CYCLE = 5;

    @Mock private OrganizationRepository organizationRepository;
    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionTriggerService triggerService;
    @Mock private SupervisionScanQuota quota;
    @Mock private SupervisionScanRotation rotation;
    @Mock private SupervisionScanService scanService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private AutonomyRunScope autonomyRunScope;

    @Captor private ArgumentCaptor<Collection<Long>> candidatesCaptor;

    private SupervisionAutonomousScanner scanner;

    @BeforeEach
    void setUp() {
        scanner = newScanner(true, MAX_PERIODIC_PER_CYCLE);

        when(organizationRepository.findAllIds()).thenReturn(List.of(ORG_ID));
        when(settingsRepository.findAll()).thenReturn(List.of(settings(true, false, 5)));
        // Une org ecartee (opt-out, pause, budget nul) n'atteint jamais l'executeur.
        lenient().doAnswer(inv -> {
            ((Runnable) inv.getArgument(1)).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(eq(ORG_ID), any(Runnable.class));
        lenient().when(quota.tryConsume(anyLong(), anyInt())).thenReturn(true);
    }

    private SupervisionAutonomousScanner newScanner(boolean enabled, int maxPeriodic) {
        return new SupervisionAutonomousScanner(enabled, PERIODIC_INTERVAL_MS, maxPeriodic,
                organizationRepository, settingsRepository, triggerService, quota, rotation,
                scanService, propertyRepository, tenantScopedExecutor, autonomyRunScope);
    }

    private static SupervisionSettings settings(boolean enabled, boolean paused, int budget) {
        SupervisionSettings settings = new SupervisionSettings();
        settings.setOrganizationId(ORG_ID);
        settings.setEnabled(enabled);
        settings.setPaused(paused);
        settings.setDailyScanBudget(budget);
        return settings;
    }

    /** File evenementielle du cycle (les logements marques « dirty »). */
    private void dirty(Long... propertyIds) {
        when(triggerService.drainDirty(ORG_ID)).thenReturn(new LinkedHashSet<>(List.of(propertyIds)));
    }

    /** Logements ACTIFS de l'org, et ceux que le tour de role designe. */
    private void activeProperties(List<Long> active, List<Long> due) {
        when(propertyRepository.findActiveIdsByOrganizationId(ORG_ID)).thenReturn(active);
        when(rotation.dueForScan(eq(ORG_ID), any(), any(Duration.class), anyInt())).thenReturn(due);
    }

    private void gateReturns(Outcome outcome, boolean executeRun) {
        doAnswer(inv -> {
            if (executeRun) {
                ((Runnable) inv.getArgument(2)).run();
            }
            return new Decision(outcome, 500_000L, 0L);
        }).when(autonomyRunScope).runPremium(eq(ORG_ID), eq("supervision_scan"), any(Runnable.class));
    }

    @Test
    @DisplayName("gate ALLOWED -> scan LLM autonome execute via runPremium")
    void whenAllowed_thenLlmScanRuns() {
        dirty(PROPERTY_ID);
        gateReturns(Outcome.ALLOWED, true);

        scanner.sweep();

        verify(scanService).autonomousScan(ORG_ID, PROPERTY_ID);
        verify(scanService, never()).deterministicScanOnly(anyLong(), anyLong());
    }

    @Test
    @DisplayName("plafond NOTIFY_ONLY -> mode degrade deterministe (0 LLM)")
    void whenCappedNotifyOnly_thenDeterministicOnly() {
        dirty(PROPERTY_ID);
        gateReturns(Outcome.CAPPED_NOTIFY_ONLY, false);

        scanner.sweep();

        verify(scanService, never()).autonomousScan(anyLong(), anyLong());
        verify(scanService).deterministicScanOnly(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("plafond PAUSE -> aucun scan (suspension demandee)")
    void whenPaused_thenNothing() {
        dirty(PROPERTY_ID);
        gateReturns(Outcome.CAPPED_PAUSE, false);

        scanner.sweep();

        verify(scanService, never()).autonomousScan(anyLong(), anyLong());
        verify(scanService, never()).deterministicScanOnly(anyLong(), anyLong());
    }

    @Test
    @DisplayName("plafond PAUSE -> la file n'est pas consommee logement par logement")
    void whenPaused_thenQueueIsAbandoned() {
        dirty(1L, 2L, 3L);
        gateReturns(Outcome.CAPPED_PAUSE, false);

        scanner.sweep();

        // Un seul prelevement de budget : la suspension vaut pour toute l'org,
        // poursuivre la file le viderait sans rien produire.
        verify(quota, times(1)).tryConsume(ORG_ID, 5);
        verify(rotation, never()).markScanned(anyLong(), anyLong());
    }

    @Test
    @DisplayName("autonomie jamais activee -> heuristiques deterministes quand meme")
    void whenDisabled_thenDeterministicScanStillRuns() {
        dirty(PROPERTY_ID);
        gateReturns(Outcome.DISABLED, false);

        scanner.sweep();

        verify(scanService, never()).autonomousScan(anyLong(), anyLong());
        verify(scanService).deterministicScanOnly(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("aucun evenement -> les logements ACTIFS dont c'est le tour sont scannes")
    void whenNothingDirty_thenPeriodicBacklogIsScanned() {
        dirty();
        activeProperties(List.of(10L, 11L), List.of(11L, 10L));
        gateReturns(Outcome.DISABLED, false);

        scanner.sweep();

        verify(scanService).deterministicScanOnly(ORG_ID, 11L);
        verify(scanService).deterministicScanOnly(ORG_ID, 10L);
        verify(rotation).markScanned(ORG_ID, 11L);
        verify(rotation).markScanned(ORG_ID, 10L);
    }

    @Test
    @DisplayName("un logement deja dans la file evenementielle n'est pas repris par le tour de role")
    void whenPropertyIsDirty_thenItIsExcludedFromBacklogCandidates() {
        dirty(PROPERTY_ID);
        activeProperties(List.of(PROPERTY_ID, 99L), List.of());
        gateReturns(Outcome.DISABLED, false);

        scanner.sweep();

        verify(rotation).dueForScan(eq(ORG_ID), candidatesCaptor.capture(),
                eq(Duration.ofMillis(PERIODIC_INTERVAL_MS)), eq(MAX_PERIODIC_PER_CYCLE));
        assertThat(candidatesCaptor.getValue()).containsExactly(99L);
        verify(scanService, times(1)).deterministicScanOnly(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("scan en echec -> le tour de role avance quand meme (pas de logement bloquant)")
    void whenScanThrows_thenRotationStillAdvances() {
        dirty(PROPERTY_ID);
        gateReturns(Outcome.DISABLED, false);
        doAnswer(inv -> {
            throw new IllegalStateException("boom");
        }).when(scanService).deterministicScanOnly(ORG_ID, PROPERTY_ID);

        scanner.sweep();

        verify(rotation).markScanned(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("budget epuise -> le balayage s'arrete sans toucher au reste de la file")
    void whenBudgetExhausted_thenSweepStops() {
        dirty();
        activeProperties(List.of(10L, 11L), List.of(10L, 11L));
        when(quota.tryConsume(ORG_ID, 5)).thenReturn(true, false);
        gateReturns(Outcome.DISABLED, false);

        scanner.sweep();

        verify(scanService).deterministicScanOnly(ORG_ID, 10L);
        verify(scanService, never()).deterministicScanOnly(ORG_ID, 11L);
    }

    @Test
    @DisplayName("complement desactive (max=0) -> aucune requete de logements actifs")
    void whenPeriodicDisabled_thenNoBacklogLookup() {
        scanner = newScanner(true, 0);
        dirty();

        scanner.sweep();

        verify(propertyRepository, never()).findActiveIdsByOrganizationId(anyLong());
        verify(rotation, never()).dueForScan(anyLong(), any(), any(Duration.class), anyInt());
    }

    // ── Quelles organisations sont balayees ─────────────────────────────────

    @Test
    @DisplayName("org sans ligne de reglages -> balayee avec le budget par defaut")
    void whenOrgHasNoSettings_thenSweptWithDefaultBudget() {
        when(settingsRepository.findAll()).thenReturn(List.of());
        dirty(PROPERTY_ID);
        gateReturns(Outcome.DISABLED, false);

        scanner.sweep();

        verify(quota).tryConsume(ORG_ID, SupervisionConfigService.DEFAULT_DAILY_SCAN_BUDGET);
        verify(scanService).deterministicScanOnly(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("opt-out explicite de l'org -> aucun scan")
    void whenOrgOptedOut_thenNothing() {
        when(settingsRepository.findAll()).thenReturn(List.of(settings(false, false, 5)));

        scanner.sweep();

        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    @Test
    @DisplayName("org en pause -> aucun scan")
    void whenOrgPaused_thenNothing() {
        when(settingsRepository.findAll()).thenReturn(List.of(settings(true, true, 5)));

        scanner.sweep();

        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    @Test
    @DisplayName("budget quotidien a zero -> aucun scan")
    void whenBudgetIsZero_thenNothing() {
        when(settingsRepository.findAll()).thenReturn(List.of(settings(true, false, 0)));

        scanner.sweep();

        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    /** Le gate premium reste le seul juge de l'appel LLM. */
    @Test
    @DisplayName("complement periodique ALLOWED -> scan LLM sur le logement du tour")
    void whenBacklogAllowed_thenLlmScanRunsOnBacklogProperty() {
        dirty();
        activeProperties(List.of(10L), List.of(10L));
        gateReturns(Outcome.ALLOWED, true);

        scanner.sweep();

        verify(scanService).autonomousScan(ORG_ID, 10L);
        verify(autonomyRunScope).runPremium(eq(ORG_ID),
                eq(com.clenzy.model.AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN), any(Runnable.class));
    }

}
