package com.clenzy.service.ai;

import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RunCreditGuardTest {
    CreditBalanceService balance=mock(CreditBalanceService.class);
    TenantContext tenant=mock(TenantContext.class);
    AiCreditGrantService grants=mock(AiCreditGrantService.class);
    RunCreditGuard guard=new RunCreditGuard(balance,tenant,grants,2000,5000);
    @Test void noCreditRefusesBeforeExecution() {
        assertThat(guard.beginRun(42L)).isFalse(); assertThat(guard.reservation(42L)).isNull();
    }
    @Test void paidAllotmentCanRecoverAndUsesOneReservationIdentity() {
        when(balance.tryReserve(eq(42L),any(UUID.class),eq(2000L))).thenReturn(false,true);
        when(grants.ensureCurrentMonthAllotment(42L)).thenReturn(true);
        assertThat(guard.beginRun(42L)).isTrue(); var id=guard.reservation(42L);
        verify(balance,times(2)).tryReserve(42L,id,2000L);
        guard.endRun();guard.endRun();verify(balance,times(1)).release(42L,id);
    }
    @Test void staffNeverReservesOrChargesOrganization() {
        when(tenant.isSuperAdmin()).thenReturn(true);
        assertThat(guard.beginRun(42L)).isTrue();guard.onDebit(42L,10000);guard.endRun();
        verifyNoInteractions(balance,grants);
    }
    @Test void retryingRunReleasesOldHoldBeforeOpeningAnother() {
        when(balance.tryReserve(eq(42L),any(UUID.class),eq(2000L))).thenReturn(true);
        guard.beginRun(42L);var id=guard.reservation(42L);guard.beginRun(42L);
        verify(balance).release(42L,id);assertThat(guard.reservation(42L)).isNotEqualTo(id);
    }
    @Test void exhaustedRunStopsAndReleaseDoesNotChargeUsageAgain() {
        when(balance.tryReserve(eq(42L),any(UUID.class),eq(2000L))).thenReturn(true);
        guard.beginRun(42L);var id=guard.reservation(42L);guard.onDebit(42L,3500);
        assertThat(guard.isExhausted()).isTrue();guard.endRun();
        verify(balance).release(42L,id);verify(balance).tryReserve(42L,id,5000);
    }
    @Test void otherOrganizationCannotUseThisReservation() {
        when(balance.tryReserve(eq(42L),any(UUID.class),eq(2000L))).thenReturn(true);
        guard.beginRun(42L);guard.onDebit(43L,5000);
        assertThat(guard.reservation(43L)).isNull();assertThat(guard.isExhausted()).isFalse();
        verify(balance,never()).tryReserve(eq(43L),any(),anyLong());
    }
}
