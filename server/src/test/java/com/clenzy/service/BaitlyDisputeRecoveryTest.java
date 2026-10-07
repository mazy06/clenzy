package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.Dispute;
import com.stripe.model.DisputeCollection;
import org.junit.jupiter.api.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyDisputeRecoveryTest {
    final StripeGateway stripe=mock(StripeGateway.class);
    final BaitlyDisputeReconciliation reconciliation=mock(BaitlyDisputeReconciliation.class);
    final TenantContext tenant=new TenantContext();
    final BaitlyDisputeRecovery recovery=new BaitlyDisputeRecovery(stripe,reconciliation,tenant);
    @BeforeEach void setup() { tenant.clear(); when(stripe.isConfigured()).thenReturn(true); }
    @AfterEach void cleanup() { tenant.clear(); TransactionSynchronizationManager.setActualTransactionActive(false); }
    DisputeCollection page(boolean more,String... ids) {
        var p=new DisputeCollection(); p.setHasMore(more);
        p.setData(java.util.Arrays.stream(ids).map(id->{ var d=new Dispute(); d.setId(id); return d; }).toList()); return p;
    }
    @Test void missingWebhooksAreDiscoveredAcrossPagesAndHistoryIsRevisited() throws Exception {
        when(stripe.listDisputePage(null)).thenReturn(page(true,"du_new","du_middle"));
        when(stripe.listDisputePage("du_middle")).thenReturn(page(false,"du_old"));
        recovery.sweep(); recovery.sweep(); recovery.sweep();
        verify(reconciliation,times(2)).reconcile("du_new"); verify(reconciliation,times(2)).reconcile("du_middle");
        verify(reconciliation).reconcile("du_old");
        verify(stripe,never()).updateDispute(any(),any(),any());
    }
    @Test void failedCaseDoesNotStarveTheNextAndWillBeRetriedNextCycle() throws Exception {
        when(stripe.listDisputePage(null)).thenReturn(page(false,"du_bad","du_good"));
        doThrow(new IllegalStateException("canonical lookup")).when(reconciliation).reconcile("du_bad");
        recovery.sweep(); recovery.sweep();
        verify(reconciliation,times(2)).reconcile("du_bad"); verify(reconciliation,times(2)).reconcile("du_good");
    }
    @Test void networkPageFailureDoesNotAdvanceTheCursor() throws Exception {
        when(stripe.listDisputePage(null)).thenThrow(new IllegalStateException("network")).thenReturn(page(false,"du_one"));
        recovery.sweep(); recovery.sweep();
        verify(stripe,times(2)).listDisputePage(null); verify(reconciliation).reconcile("du_one");
    }
    @Test void invalidPageNeverMutatesAnyLocalDispute() throws Exception {
        var tooMany=page(false); tooMany.setData(java.util.stream.IntStream.range(0,26).mapToObj(i->{ var d=new Dispute(); d.setId("du_"+i); return d; }).toList());
        for(var invalid:List.of(page(true),page(false,"du_duplicate","du_duplicate"),tooMany)) {
            when(stripe.listDisputePage(null)).thenReturn(invalid); recovery.sweep();
        }
        verifyNoInteractions(reconciliation);
    }
    @Test void transactionOrTenantScopeCannotStartACrossOrganizationSweep() throws Exception {
        tenant.setOrganizationId(7L);
        assertThatThrownBy(recovery::sweep).isInstanceOf(IllegalStateException.class);
        assertThat(tenant.getOrganizationId()).isEqualTo(7L);
        tenant.clear(); TransactionSynchronizationManager.setActualTransactionActive(true);
        assertThatThrownBy(recovery::sweep).isInstanceOf(IllegalStateException.class);
        verify(stripe,never()).listDisputePage(any()); verifyNoInteractions(reconciliation);
    }
    @Test void disabledStripeDoesNotCallTheNetwork() throws Exception {
        when(stripe.isConfigured()).thenReturn(false); recovery.sweep();
        verify(stripe,never()).listDisputePage(any()); verifyNoInteractions(reconciliation);
    }
}
