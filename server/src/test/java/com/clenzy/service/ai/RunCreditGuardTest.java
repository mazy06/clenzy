package com.clenzy.service.ai;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Garde de credits d'un run (T-06b) : pre-vol → reservation plancher (avec
 * self-heal d'un abonne eligible si solde 0), re-check inter-tours par chunks,
 * epuisement en vol, reconciliation (release ou debit force de l'overshoot),
 * exemption du staff plateforme.
 */
@ExtendWith(MockitoExtension.class)
class RunCreditGuardTest {

    private static final long FLOOR = 2000L;
    private static final long CHUNK = 5000L;

    @Mock private CreditBalanceService balanceService;
    @Mock private com.clenzy.tenant.TenantContext tenantContext;
    @Mock private AiCreditGrantService creditGrantService;

    private RunCreditGuard guard;

    private RunCreditGuard guard() {
        guard = new RunCreditGuard(balanceService, tenantContext, creditGrantService, FLOOR, CHUNK);
        return guard;
    }

    @AfterEach
    void cleanupThreadLocal() {
        if (guard != null) {
            guard.endRun(); // no-op si deja clos — isole les tests du thread partage
        }
    }

    @Test
    void beginRun_refused_whenFloorReservationFails_andNotEligible() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(false);
        when(creditGrantService.ensureCurrentMonthAllotment(42L)).thenReturn(false);

        assertThat(guard().beginRun(42L)).isFalse();
        assertThat(guard.isExhausted()).isFalse();
    }

    @Test
    void beginRun_selfHeals_whenEligibleSubscriberHasNoPocketYet() {
        // 1re reservation echoue (solde 0), auto-dotation reussit, 2e reservation passe.
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(false, true);
        when(creditGrantService.ensureCurrentMonthAllotment(42L)).thenReturn(true);

        assertThat(guard().beginRun(42L)).isTrue();

        guard.onDebit(42L, 500L);
        verify(balanceService).applyConsumptionToGrants(42L, 500L);
    }

    @Test
    void platformStaff_exempt() {
        when(tenantContext.isSuperAdmin()).thenReturn(true);

        // Staff plateforme → autorisé sans réservation, dotation ni débit.
        assertThat(guard().beginRun(42L)).isTrue();
        guard.onDebit(42L, 10_000L);
        assertThat(guard.isExhausted()).isFalse();
        guard.endRun();

        verify(balanceService, never()).tryReserve(anyLong(), anyLong());
        verify(balanceService, never()).applyConsumptionToGrants(anyLong(), anyLong());
        verify(creditGrantService, never()).ensureCurrentMonthAllotment(anyLong());
    }

    @Test
    void debitWithinFloor_appliesToGrants_noExtraReservation() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(true);
        guard().beginRun(42L);

        guard.onDebit(42L, 1500L);

        assertThat(guard.isExhausted()).isFalse();
        verify(balanceService).applyConsumptionToGrants(42L, 1500L);
        verify(balanceService, never()).tryReserve(42L, CHUNK);
    }

    @Test
    void debitBeyondFloor_reservesChunk() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(true);
        when(balanceService.tryReserve(42L, CHUNK)).thenReturn(true);
        guard().beginRun(42L);

        guard.onDebit(42L, 3000L); // > plancher 2000 → chunk 5000 re-reserve

        assertThat(guard.isExhausted()).isFalse();
        verify(balanceService).tryReserve(42L, CHUNK);
    }

    @Test
    void chunkRefused_marksExhausted() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(true);
        when(balanceService.tryReserve(42L, CHUNK)).thenReturn(false);
        guard().beginRun(42L);

        guard.onDebit(42L, 3000L);

        assertThat(guard.isExhausted()).isTrue();
    }

    @Test
    void endRun_releasesUnconsumedReservation() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(true);
        guard().beginRun(42L);
        guard.onDebit(42L, 500L);

        guard.endRun();

        verify(balanceService).release(42L, FLOOR - 500L);
        verify(balanceService, never()).forceDebit(anyLong(), anyLong());
        assertThat(guard.isExhausted()).isFalse(); // ThreadLocal nettoye
    }

    @Test
    void endRun_forceDebitsOvershoot_whenExhausted() {
        when(balanceService.tryReserve(42L, FLOOR)).thenReturn(true);
        when(balanceService.tryReserve(42L, CHUNK)).thenReturn(false);
        guard().beginRun(42L);
        guard.onDebit(42L, 3500L); // reserve 2000, consomme 3500, chunk refuse

        guard.endRun();

        verify(balanceService).forceDebit(42L, 1500L);
        verify(balanceService, never()).release(eq(42L), anyLong());
    }

    @Test
    void debitWithoutGuardedRun_isNoOp() {
        guard().onDebit(42L, 1000L);

        verify(balanceService, never()).applyConsumptionToGrants(anyLong(), anyLong());
    }
}
