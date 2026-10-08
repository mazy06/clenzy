package com.clenzy.service.payout;

import com.clenzy.model.PayoutRecoveryJob;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.StripeBankPayoutHandler;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.Payout;
import com.stripe.model.StripeCollection;
import org.junit.jupiter.api.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PayoutRecoveryServiceTest {
    private final PayoutRecoveryStore store=mock(PayoutRecoveryStore.class);
    private final StripeGateway stripe=mock(StripeGateway.class);
    private final StripeBankPayoutHandler observer=mock(StripeBankPayoutHandler.class);
    private final TenantContext tenant=new TenantContext();
    private final Instant now=Instant.parse("2026-10-05T12:00:00Z");
    private final PayoutRecoveryService service=new PayoutRecoveryService(store,stripe,observer,tenant,Clock.fixed(now,ZoneOffset.UTC));
    private final PayoutRecoveryJob job=mock(PayoutRecoveryJob.class);
    @BeforeEach void setup() {
        tenant.clear();tenant.setOrganizationId(7L);
        when(stripe.isConfigured()).thenReturn(true);
        when(job.getAccountId()).thenReturn("acct_provider");when(job.getEarliestAt()).thenReturn(now.minusSeconds(86400));
        when(job.getWindowEnd()).thenReturn(now);when(job.getAfterPayoutId()).thenReturn("po_before");
        when(store.claim(now)).thenReturn(Optional.of(job),Optional.empty());when(store.renew(job,now)).thenReturn(true);
    }
    @AfterEach void cleanup() { tenant.clear(); }
    private StripeCollection<Payout> page(boolean more,String...ids) {
        var response=new StripeCollection<Payout>();response.setHasMore(more);
        response.setData(Arrays.stream(ids).map(id -> {var p=new Payout();p.setId(id);p.setLivemode(false);p.setCreated(now.minusSeconds(50).getEpochSecond());return p;}).toList());
        return response;
    }
    @Test void resumesWindowAndCommitsCursorOnlyAfterEveryObservation() throws Exception {
        when(stripe.listConnectedPayouts(any(),anyLong(),anyLong(),any())).thenReturn(page(true,"po_first","po_last"));
        service.sweep();
        var order=inOrder(observer,store);
        order.verify(observer).recover("acct_provider",false,"po_first",now);
        order.verify(observer).recover("acct_provider",false,"po_last",now);
        order.verify(store).checkpoint(job,"po_last",false,now);
        verify(stripe).listConnectedPayouts("acct_provider",now.minusSeconds(86400).getEpochSecond(),now.getEpochSecond(),"po_before");
        verify(stripe,never()).createTransfer(any(),any());
        assertThat(tenant.isSystemOrg()).isFalse();assertThat(tenant.getOrganizationId()).isEqualTo(7L);
    }
    @Test void failureKeepsCursorAndDoesNotBlockOtherAccounts() throws Exception {
        var second=mock(PayoutRecoveryJob.class);
        when(second.getAccountId()).thenReturn("acct_second");when(second.getEarliestAt()).thenReturn(now.minusSeconds(30));when(second.getWindowEnd()).thenReturn(now);
        when(store.claim(now)).thenReturn(Optional.of(job),Optional.of(second),Optional.empty());
        when(stripe.listConnectedPayouts(eq("acct_provider"),anyLong(),anyLong(),any())).thenThrow(new ApiConnectionException("offline"));
        when(stripe.listConnectedPayouts(eq("acct_second"),anyLong(),anyLong(),isNull())).thenReturn(page(false));
        service.sweep();
        verify(store).failed(job,now);verify(store,never()).checkpoint(eq(job),any(),anyBoolean(),any());
        verify(store).checkpoint(second,null,true,now);
    }
    @Test void observerFailureAndLostLeaseNeverAdvanceCursor() throws Exception {
        when(stripe.listConnectedPayouts(any(),anyLong(),anyLong(),any())).thenReturn(page(false,"po_first"));
        doThrow(new ApiConnectionException("offline")).when(observer).recover(any(),anyBoolean(),any(),any());
        service.sweep();verify(store).failed(job,now);verify(store,never()).checkpoint(any(),any(),anyBoolean(),any());
        reset(observer);when(store.claim(now)).thenReturn(Optional.of(job),Optional.empty());when(store.renew(job,now)).thenReturn(false);
        service.sweep();verifyNoInteractions(observer);
    }
    @Test void malformedRepeatedOrWrongModePagesFailClosed() throws Exception {
        for(var response: List.of(page(true),page(true,"po_before"),page(true,"po_duplicate","po_duplicate"))) {
            when(store.claim(now)).thenReturn(Optional.of(job),Optional.empty());
            when(stripe.listConnectedPayouts(any(),anyLong(),anyLong(),any())).thenReturn(response);service.sweep();
        }
        var wrong=page(false,"po_live");wrong.getData().getFirst().setLivemode(true);
        when(store.claim(now)).thenReturn(Optional.of(job),Optional.empty());
        when(stripe.listConnectedPayouts(any(),anyLong(),anyLong(),any())).thenReturn(wrong);service.sweep();
        verify(store,times(4)).failed(job,now);verify(store,never()).checkpoint(any(),any(),anyBoolean(),any());
    }
    @Test void missingCredentialsNeverCallsPspAndTransactionIsRejected() {
        when(stripe.isConfigured()).thenReturn(false);service.sweep();verifyNoInteractions(observer);
        verify(store,never()).seed();verify(store).flagStalled(now);
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try { assertThatThrownBy(service::sweep).isInstanceOf(IllegalStateException.class); }
        finally { TransactionSynchronizationManager.setActualTransactionActive(false); }
    }
}
