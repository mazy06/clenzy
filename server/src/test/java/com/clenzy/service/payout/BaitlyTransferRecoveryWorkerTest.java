package com.clenzy.service.payout;

import com.clenzy.payment.payout.BaitlyStripeTransferRecovery;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import static org.mockito.Mockito.*;

class BaitlyTransferRecoveryWorkerTest {
    final BaitlyTransferRecoveryStore store = mock(BaitlyTransferRecoveryStore.class);
    final BaitlyStripeTransferRecovery stripe = mock(BaitlyStripeTransferRecovery.class);
    final ActionItemWriter actions = mock(ActionItemWriter.class);
    final BaitlyTransferRecoveryWorker worker = new BaitlyTransferRecoveryWorker(store,stripe,mock(TenantScopedExecutor.class),actions);
    final BaitlyTransferRecoveryStore.Candidate candidate = new BaitlyTransferRecoveryStore.Candidate(1L,7L);
    final BaitlyTransferRecoveryStore.Instruction instruction = new BaitlyTransferRecoveryStore.Instruction(
            1L,7L,2L,"tr_test","acct_test","py_test",false,new BigDecimal("30"),new BigDecimal("30"),"EUR","REF-test",Instant.now());
    @Test void noRefundConfirmationMeansNoNetwork() {
        when(store.claim(7L,1L)).thenReturn(Optional.empty());
        worker.process(candidate); verifyNoInteractions(stripe,actions);
    }
    @Test void notificationFailureNeverDowngradesConfirmedRecovery() throws Exception {
        when(store.claim(7L,1L)).thenReturn(Optional.of(instruction));
        when(stripe.recover(instruction)).thenReturn("trr_test");
        doThrow(new IllegalStateException("notification unavailable")).when(actions).resolve(any(),any(),any(),any());
        worker.process(candidate);
        verify(store).confirm(7L,1L,"trr_test"); verify(store,never()).review(any(),any(),any());
        verify(actions,never()).record(any());
    }
    @Test void lostResponseKeepsDebtVisibleWithoutInventingAProof() throws Exception {
        when(store.claim(7L,1L)).thenReturn(Optional.of(instruction));
        when(stripe.recover(instruction)).thenThrow(new IllegalStateException("timeout with private details"));
        worker.process(candidate);
        verify(store,never()).confirm(any(),any(),any());
        verify(store).review(7L,1L,"STRIPE_RECOVERY_UNCONFIRMED");
        verify(actions).record(argThat(a -> a.amount().compareTo(new BigDecimal("30"))==0
                && !a.detail().contains("private") && a.organizationId().equals(7L)));
    }
}
