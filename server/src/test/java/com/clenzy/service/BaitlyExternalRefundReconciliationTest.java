package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyExternalRefundReconciliationTest {
    final StripeGateway stripe=mock(StripeGateway.class);
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final BaitlyExternalRefundStore store=mock(BaitlyExternalRefundStore.class);
    final TenantScopedExecutor tenants=mock(TenantScopedExecutor.class);
    final ActionItemWriter actions=mock(ActionItemWriter.class);
    final BaitlyExternalRefundReconciliation service=new BaitlyExternalRefundReconciliation(stripe,payments,store,tenants,actions);
    PaymentTransaction original;
    Session session;
    Refund refund;
    Charge charge;
    BaitlyExternalRefundStore.State state(boolean review) { return new BaitlyExternalRefundStore.State(7L,"EXT-re_external","re_external",new BigDecimal("45"),"EUR",review); }
    @BeforeEach void fixtures() throws Exception {
        original=RefundCreditNotePersistenceTest.transaction("TX-original",TransactionType.CHECKOUT); original.setProviderTxId("cs_original");
        session=new Session(); session.setId("cs_original"); session.setPaymentIntent("pi_original"); session.setStatus("complete"); session.setMode("payment");
        session.setPaymentStatus("paid"); session.setCurrency("eur"); session.setAmountTotal(4500L);
        session.setMetadata(new HashMap<>(Map.of("transactionRef","TX-original","sourceType","INTERVENTION","sourceId","364","orgId","7")));
        refund=new Refund(); refund.setId("re_external"); refund.setPaymentIntent("pi_original"); refund.setAmount(4500L);
        refund.setCurrency("eur"); refund.setStatus("succeeded"); refund.setCharge("ch_original");
        charge=new Charge(); charge.setId("ch_original"); charge.setPaymentIntent("pi_original"); charge.setPaid(true);
        charge.setCurrency("eur"); charge.setAmount(4500L); charge.setAmountRefunded(4500L);
        when(stripe.retrieveRefund("re_external")).thenReturn(refund); when(stripe.sessionsForPaymentIntent("pi_original")).thenReturn(List.of(session));
        when(payments.findByProviderTxId("cs_original")).thenReturn(Optional.of(original));
        when(stripe.listPaymentRefunds("pi_original")).thenReturn(List.of(refund)); when(stripe.retrieveCharge("ch_original")).thenReturn(charge);
        when(store.observe(any())).thenReturn(state(true)); when(store.complete(any(),anyList())).thenReturn(state(false)); when(store.review(anyString())).thenReturn(state(true));
        when(store.orderedExternal(anyList())).thenAnswer(c -> c.getArgument(0));
        doAnswer(c -> { c.<Runnable>getArgument(1).run(); return null; }).when(tenants).runAsOrganization(eq(7L),any());
    }
    @Test void readsCanonicalProofAndCompletesWithoutAnyStripeMutation() throws Exception {
        var forged=new Refund(); forged.setId(refund.getId()); forged.setAmount(1L); forged.setStatus("failed");
        service.onWebhook(forged);
        var order=inOrder(stripe,store); order.verify(stripe).retrieveRefund("re_external");
        order.verify(stripe).sessionsForPaymentIntent("pi_original"); order.verify(store).observe(any());
        order.verify(stripe).listPaymentRefunds("pi_original"); order.verify(stripe).retrieveCharge("ch_original"); order.verify(store).complete(any(),anyList());
        verifyNoMoreInteractions(stripe);
        verify(actions).record(argThat(a -> a.organizationId()==7L && a.actionType().equals("EXTERNAL_REFUND")));
        verify(actions).resolve(eq(7L),any(),eq("re_external"),anyString());
    }
    @ParameterizedTest @ValueSource(strings={"org","source","source-id","ref","session","amount","currency","intent","not-paid","other-psp","too-much","negative"})
    void mismatchedProofNeverCreatesALocalRefund(String defect) {
        switch(defect) {
            case "org" -> session.getMetadata().put("orgId","8"); case "source" -> session.getMetadata().put("sourceType","RESERVATION");
            case "source-id" -> session.getMetadata().put("sourceId","365"); case "ref" -> session.getMetadata().put("transactionRef","TX-other");
            case "session" -> original.setProviderTxId("cs_other"); case "amount" -> session.setAmountTotal(1L);
            case "currency" -> refund.setCurrency("usd"); case "intent" -> session.setPaymentIntent("pi_other");
            case "not-paid" -> session.setPaymentStatus("unpaid"); case "other-psp" -> original.setProviderType(PaymentProviderType.CMI);
            case "too-much" -> refund.setAmount(4501L); case "negative" -> refund.setAmount(-1L);
        }
        assertThatThrownBy(() -> service.onWebhook(refund)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(store,actions);
    }
    @ParameterizedTest @ValueSource(strings={"pending","failed","canceled","requires_action"})
    void nonSuccessfulRefundIsRecordedButNeverReconciled(String status) throws Exception {
        refund.setStatus(status); service.onWebhook(refund);
        verify(store).observe(any()); verify(store,never()).complete(any(),anyList()); verify(stripe,never()).listPaymentRefunds(any());
    }
    @Test void partialOrAmbiguousCasesRemainDurablyVisible() throws Exception {
        doThrow(new IllegalStateException("partial")).when(store).complete(any(),anyList());
        service.onWebhook(refund); verify(store).review("EXT-re_external"); verify(actions,never()).resolve(any(),any(),any(),any());
    }
    @Test void malformedAdditionalRefundDoesNotGuessAnAllocation() throws Exception {
        var second=new Refund(); second.setId("re_other"); second.setStatus("succeeded");
        when(stripe.listPaymentRefunds("pi_original")).thenReturn(List.of(refund,second));
        assertThatThrownBy(() -> service.onWebhook(refund)).isInstanceOf(RuntimeException.class);
        verify(store).observe(any()); verify(store,never()).complete(any(),anyList());
    }
    @Test void unrelatedPlatformProductsAndManagedDecisionsAreNotImported() throws Exception {
        when(payments.findByProviderTxId("cs_original")).thenReturn(Optional.empty()); service.onWebhook(refund);
        refund.setMetadata(Map.of("baitly_refund_ref","REF-managed")); service.onWebhook(refund);
        verifyNoInteractions(store,actions);
    }
    @Test void networkFailureAfterObservationKeepsAReconciliationCandidate() throws Exception {
        when(stripe.listPaymentRefunds("pi_original")).thenThrow(new IllegalStateException("network"));
        assertThatThrownBy(() -> service.onWebhook(refund)).hasMessage("network"); verify(store).observe(any()); verify(store,never()).complete(any(),anyList());
    }
    @Test void canonicalChargeMustMatchBeforeAccounting() throws Exception {
        charge.setPaymentIntent("pi_other"); assertThatThrownBy(() -> service.onWebhook(refund)).hasMessageContaining("Charge");
        verify(store,never()).complete(any(),anyList());
    }
    private Refund additional() {
        refund.setAmount(501L);
        var second=new Refund(); second.setId("re_other"); second.setStatus("succeeded"); second.setAmount(3999L);
        second.setPaymentIntent("pi_original"); second.setCurrency("eur"); second.setCharge("ch_original");
        return second;
    }
    @Test void allExternalProofsAreObservedBeforeProcessingInDurableOrder() throws Exception {
        var second=additional(); when(stripe.listPaymentRefunds("pi_original")).thenReturn(List.of(second,refund));
        when(store.orderedExternal(anyList())).thenAnswer(c -> {
            List<BaitlyExternalRefundProof> proofs=c.getArgument(0);
            return List.of(proofs.get(1),proofs.get(0));
        });
        service.onWebhook(refund);
        var order=inOrder(store);
        order.verify(store).observe(argThat(p -> p.refundId().equals("re_external")));
        order.verify(store).observe(argThat(p -> p.refundId().equals("re_other")));
        order.verify(store).complete(argThat(p -> p.refundId().equals("re_external")),argThat(p -> p.size()==2));
        order.verify(store).complete(argThat(p -> p.refundId().equals("re_other")),argThat(p -> p.size()==2));
        verify(stripe,never()).createRefund(any(),any());
    }
    @ParameterizedTest @ValueSource(strings={"sum","charge","intent","currency","duplicate","missing","over-budget","charge-amount"})
    void ambiguousSnapshotNeverCompletesAnyRefund(String defect) throws Exception {
        var second=additional(); var rows=List.of(refund,second);
        switch(defect) {
            case "sum" -> charge.setAmountRefunded(4499L);
            case "charge" -> second.setCharge("ch_other");
            case "intent" -> second.setPaymentIntent("pi_other");
            case "currency" -> second.setCurrency("usd");
            case "duplicate" -> rows=List.of(refund,refund);
            case "missing" -> rows=List.of(second);
            case "over-budget" -> second.setAmount(4000L);
            case "charge-amount" -> charge.setAmount(4501L);
        }
        when(stripe.listPaymentRefunds("pi_original")).thenReturn(rows);
        assertThatThrownBy(() -> service.onWebhook(refund)).isInstanceOf(RuntimeException.class);
        verify(store,never()).complete(any(),anyList());
    }
    @Test void pendingSiblingPreventsAccountingUntilTheSnapshotIsFinal() throws Exception {
        var second=additional(); second.setStatus("pending");
        when(stripe.listPaymentRefunds("pi_original")).thenReturn(List.of(refund,second));
        service.onWebhook(refund); verify(store,never()).complete(any(),anyList());
    }
    @Test void workerResumesDurableProofAndAdvancesPastFailedCandidate() throws Exception {
        when(store.candidates(0)).thenReturn(List.of(new BaitlyExternalRefundStore.Candidate(25,7L,"EXT-re_external","re_external")));
        when(stripe.retrieveRefund("re_external")).thenThrow(new IllegalStateException("timeout"));
        service.resume(); service.resume(); verify(store).review("EXT-re_external"); verify(store).candidates(25);
    }
}
