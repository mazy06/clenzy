package com.clenzy.service;

import com.clenzy.model.PaymentDispute;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.*;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyDisputeReconciliationTest {
    final StripeGateway stripe=mock(StripeGateway.class);
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final BaitlyDisputeStore store=mock(BaitlyDisputeStore.class);
    final TenantScopedExecutor tenants=mock(TenantScopedExecutor.class);
    final ActionItemWriter actions=mock(ActionItemWriter.class);
    final PropertyRepository properties=mock(PropertyRepository.class);
    final SupervisionSuggestionService suggestions=mock(SupervisionSuggestionService.class);
    final BaitlyDisputeReconciliation service=new BaitlyDisputeReconciliation(stripe,payments,store,tenants,actions,properties,suggestions);
    BaitlyDisputeProofTest fixture=new BaitlyDisputeProofTest();
    @BeforeEach void setup() throws Exception {
        fixture.seed();
        when(stripe.retrieveDispute("dp_test")).thenReturn(fixture.dispute);
        when(stripe.retrieveCharge("ch_test")).thenReturn(fixture.charge);
        when(stripe.sessionsForPaymentIntent("pi_test")).thenReturn(List.of(fixture.session));
        when(stripe.retrieveSession("cs_test")).thenReturn(fixture.session);
        when(payments.findByProviderTxId("cs_test")).thenReturn(Optional.of(fixture.payment));
        doAnswer(call->{ ((Runnable)call.getArgument(1)).run();return null; }).when(tenants).runAsOrganization(eq(7L),any());
        when(store.observe(any())).thenAnswer(call->{ var proof=(BaitlyDisputeProof)call.getArgument(0);
            var row=new PaymentDispute();row.setOrganizationId(proof.org());row.setProviderDisputeId(proof.dispute());
            row.setAmount(proof.amount());row.setCurrency(proof.currency());return row; });
    }
    @Test void checkoutChargeIsResolvedToItsPaymentAndOrganization() {
        service.reconcile("dp_test");
        verify(store).observe(argThat(proof->proof.org().equals(7L)&&proof.paymentId().equals(1L)&&proof.charge().equals("ch_test")));
        verify(actions).record(argThat(action->action.organizationId().equals(7L)&&action.subjectRef().equals("dp_test")));
        verify(payments,never()).findByProviderTxId("ch_test");
    }
    @Test void unrecognizedPaymentDoesNotInventALocalDispute() {
        when(payments.findByProviderTxId("cs_test")).thenReturn(Optional.empty());
        service.reconcile("dp_test");verifyNoInteractions(store,actions,tenants);
    }
    @Test void inconsistentCanonicalEvidenceDoesNotNotifyOrMutate() {
        fixture.charge.setPaymentIntent("pi_other");
        assertThatThrownBy(()->service.reconcile("dp_test")).hasMessageContaining("Charge du litige");
        verifyNoInteractions(store,actions,tenants);
    }
    @Test void staleOpenedEventDoesNotReopenAnAlreadyWonStoredCase() {
        var row=new PaymentDispute(); row.setOrganizationId(7L);row.setProviderDisputeId("dp_test");
        row.setStatus(PaymentDispute.Status.WON);row.setOutcome("won");row.setFundingHeld(false);
        doReturn(row).when(store).observe(any());
        service.reconcile("dp_test");
        verify(actions).resolve(eq(7L),any(),eq("dp_test"),eq("stripe:won")); verify(actions,never()).record(any());
    }
}
