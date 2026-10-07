package com.clenzy.service;

import com.clenzy.model.BaitlySubscriptionOrder;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.BaitlySubscriptionOrderRepository;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlySubscriptionRecoveryTest {
    @Test void outageCannotKeepExpiredAccessOrBlockFollowingContracts() throws Exception {
        var repo=mock(BaitlySubscriptionOrderRepository.class);var service=mock(BaitlyMonthlySubscriptionService.class);
        var billing=mock(BaitlySubscriptionBilling.class);var stripe=mock(StripeGateway.class);
        var first=order(1L,"ACTIVE");var second=order(2L,"ACTIVE");
        when(repo.recoveryBatch(eq(0L),any())).thenReturn(List.of(first,second));
        doThrow(new IllegalStateException("offline")).when(billing).refresh("sub_1");
        new BaitlySubscriptionRecovery(repo,service,billing,stripe,mock(InscriptionService.class),mock(BaitlySubscriptionAmendments.class)).sweep();
        var calls=inOrder(billing);calls.verify(billing).expirePaidAccess(1L,2L);calls.verify(billing).refresh("sub_1");
        calls.verify(billing).expirePaidAccess(2L,2L);calls.verify(billing).refresh("sub_2");
        verifyNoInteractions(stripe,service);
    }
    @Test void paidCheckoutIsReconciledAndCursorReturnsToTheBeginning() throws Exception {
        var repo=mock(BaitlySubscriptionOrderRepository.class);var service=mock(BaitlyMonthlySubscriptionService.class);
        var billing=mock(BaitlySubscriptionBilling.class);var stripe=mock(StripeGateway.class);
        when(repo.recoveryBatch(eq(0L),any())).thenReturn(List.of(order(5L,"CHECKOUT_OPEN")));
        when(repo.recoveryBatch(eq(5L),any())).thenReturn(List.of());
        var session=new Session();session.setId("cs_5");session.setStatus("complete");session.setPaymentStatus("paid");session.setSubscription("sub_5");
        when(stripe.retrieveSession("cs_5")).thenReturn(session);
        var recovery=new BaitlySubscriptionRecovery(repo,service,billing,stripe,mock(InscriptionService.class),mock(BaitlySubscriptionAmendments.class));recovery.sweep();recovery.sweep();recovery.sweep();
        verify(service,times(2)).complete("cs_5");verify(billing,times(2)).refresh("sub_5");
        verify(repo,times(2)).recoveryBatch(eq(0L),any());verify(service,never()).expire(any());
    }
    @Test void openAndUnpaidCheckoutNeverActivateRights() throws Exception {
        var repo=mock(BaitlySubscriptionOrderRepository.class);var service=mock(BaitlyMonthlySubscriptionService.class);
        var billing=mock(BaitlySubscriptionBilling.class);var stripe=mock(StripeGateway.class);
        when(repo.recoveryBatch(eq(0L),any())).thenReturn(List.of(order(1L,"CHECKOUT_OPEN"),order(2L,"CHECKOUT_OPEN")));
        var open=new Session();open.setId("cs_1");open.setStatus("open");open.setPaymentStatus("unpaid");
        var expired=new Session();expired.setId("cs_2");expired.setStatus("expired");expired.setPaymentStatus("unpaid");
        when(stripe.retrieveSession("cs_1")).thenReturn(open);when(stripe.retrieveSession("cs_2")).thenReturn(expired);
        new BaitlySubscriptionRecovery(repo,service,billing,stripe,mock(InscriptionService.class),mock(BaitlySubscriptionAmendments.class)).sweep();
        verify(service).expire("cs_2");verify(service,never()).complete(any());verify(billing,never()).refresh(any());
    }
    private BaitlySubscriptionOrder order(Long id,String status) {
        var order=new BaitlySubscriptionOrder();org.springframework.test.util.ReflectionTestUtils.setField(order,"id",id);
        order.setOrganizationId(2L);order.setStatus(status);
        order.setCheckoutSessionId("cs_"+id);order.setStripeSubscriptionId("sub_"+id);return order;
    }
}
