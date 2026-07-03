package com.clenzy.scheduler;

import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.clenzy.service.ai.AutonomyBudgetService.Decision;
import com.clenzy.service.ai.AutonomyBudgetService.Outcome;
import com.clenzy.service.ai.AutonomyRunScope;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * X8-b : le scan LLM autonome est un comportement premium gated par
 * AutonomyRunScope. ALLOWED → scan LLM ; CAPPED_NOTIFY_ONLY → heuristiques
 * deterministes seules (0 LLM) ; CAPPED_PAUSE / DISABLED → rien.
 */
@ExtendWith(MockitoExtension.class)
class SupervisionAutonomousScannerTest {

    private static final Long ORG_ID = 7L;
    private static final Long PROPERTY_ID = 42L;

    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionTriggerService triggerService;
    @Mock private SupervisionScanQuota quota;
    @Mock private SupervisionScanService scanService;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private AutonomyRunScope autonomyRunScope;

    private SupervisionAutonomousScanner scanner;

    @BeforeEach
    void setUp() {
        scanner = new SupervisionAutonomousScanner(true, settingsRepository, triggerService,
                quota, scanService, tenantScopedExecutor, autonomyRunScope);

        SupervisionSettings settings = new SupervisionSettings();
        settings.setOrganizationId(ORG_ID);
        settings.setDailyScanBudget(5);
        when(settingsRepository.findByEnabledTrueAndPausedFalse()).thenReturn(List.of(settings));
        // TenantScopedExecutor : execute le runnable directement (contexte pose simule)
        doAnswer(inv -> {
            ((Runnable) inv.getArgument(1)).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(eq(ORG_ID), any(Runnable.class));
        when(triggerService.drainDirty(ORG_ID)).thenReturn(Set.of(PROPERTY_ID));
        when(quota.tryConsume(anyLong(), anyInt())).thenReturn(true);
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
        gateReturns(Outcome.ALLOWED, true);

        scanner.sweep();

        verify(scanService).autonomousScan(ORG_ID, PROPERTY_ID);
        verify(scanService, never()).deterministicScanOnly(anyLong(), anyLong());
    }

    @Test
    @DisplayName("plafond NOTIFY_ONLY -> mode degrade deterministe (0 LLM)")
    void whenCappedNotifyOnly_thenDeterministicOnly() {
        gateReturns(Outcome.CAPPED_NOTIFY_ONLY, false);

        scanner.sweep();

        verify(scanService, never()).autonomousScan(anyLong(), anyLong());
        verify(scanService).deterministicScanOnly(ORG_ID, PROPERTY_ID);
    }

    @Test
    @DisplayName("plafond PAUSE ou comportement desactive -> aucun scan")
    void whenPausedOrDisabled_thenNothing() {
        gateReturns(Outcome.CAPPED_PAUSE, false);
        scanner.sweep();

        gateReturns(Outcome.DISABLED, false);
        scanner.sweep();

        verify(scanService, never()).autonomousScan(anyLong(), anyLong());
        verify(scanService, never()).deterministicScanOnly(anyLong(), anyLong());
    }
}
