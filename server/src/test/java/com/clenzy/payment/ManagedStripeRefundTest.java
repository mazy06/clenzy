package com.clenzy.payment;

import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ManagedStripeRefundTest {
    StripeGateway gateway = mock(StripeGateway.class);
    ManagedStripeRefund service = new ManagedStripeRefund(gateway);
    BigDecimal amount = new BigDecimal("35.00");
    Session session;
    Refund refund;
    RefundContext context(String id, LocalDateTime at) {
        return new RefundContext(7L, "cs_test", "TX-original", "EUR", amount, "REF-case", id, at);
    }
    @BeforeEach void setup() throws Exception {
        session = new Session(); session.setId("cs_test"); session.setMode("payment"); session.setStatus("complete");
        session.setPaymentStatus("paid"); session.setPaymentIntent("pi_test"); session.setAmountTotal(3500L);
        session.setCurrency("eur"); session.setMetadata(Map.of("transactionRef", "TX-original"));
        when(gateway.retrieveSession("cs_test")).thenReturn(session);
        session.setLivemode(false);
        var intent = new com.stripe.model.PaymentIntent(); intent.setId("pi_test"); intent.setLatestCharge("ch_test");
        var charge = new com.stripe.model.Charge(); charge.setId("ch_test"); charge.setPaymentIntent("pi_test");
        charge.setPaid(true); charge.setDisputed(false); charge.setLivemode(false); charge.setAmount(3500L); charge.setCurrency("eur");
        when(gateway.retrievePaymentIntent("pi_test")).thenReturn(intent);
        when(gateway.retrieveCharge("ch_test")).thenReturn(charge);
        refund = new Refund(); refund.setId("re_test"); refund.setAmount(3500L); refund.setCurrency("eur");
        refund.setPaymentIntent("pi_test"); refund.setStatus("succeeded");
        refund.setMetadata(Map.of("baitly_refund_ref", "REF-case", "originalTransactionRef", "TX-original", "organizationId", "7"));
    }
    @Test void retryAfterTimeoutFindsProofWithoutAnotherEmission() throws Exception {
        when(gateway.findPaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThat(service.execute(context(null, LocalDateTime.now().minusDays(2)), amount).success()).isTrue();
        verify(gateway, never()).createRefund(any(), any());
    }

    @Test void seriesRefundsRemainingBalanceAfterExactExternalProof() throws Exception {
        var external=new Refund(); external.setId("re_external"); external.setPaymentIntent("pi_test");
        external.setAmount(500L); external.setCurrency("eur"); external.setStatus("succeeded");
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of(external));
        refund.setAmount(3000L); when(gateway.createRefund(any(),any())).thenReturn(refund);
        when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThat(service.executeSeries(context(null,LocalDateTime.now()),new BigDecimal("30"),
                Map.of("REF-case",new BigDecimal("30")),Map.of("re_external",new BigDecimal("5"))).success()).isTrue();
        verify(gateway).createRefund(argThat(p -> p.getAmount()==3000L),eq("baitly-refund-REF-case"));
    }
    @Test void seriesRequiresAllPriorProofsAndRejectsUnknownExternalRefunds() throws Exception {
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of());
        assertThatThrownBy(()->service.executeSeries(context(null,LocalDateTime.now()),new BigDecimal("30"),
                Map.of("REF-case",new BigDecimal("30")),Map.of("re_external",new BigDecimal("5")))).hasMessageContaining("antérieure");
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of(refund));
        assertThatThrownBy(()->service.executeSeries(context(null,LocalDateTime.now()),new BigDecimal("30"),
                Map.of("REF-case",new BigDecimal("30")),Map.of())).hasMessageContaining("non rapproché");
        verify(gateway,never()).createRefund(any(),any());
    }
    @Test void seriesRetryFindsSamePartialProofAndNeverCreatesTwice() throws Exception {
        refund.setAmount(1000L); when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of(refund));
        for(int i=0;i<2;i++) assertThat(service.executeSeries(context(null,LocalDateTime.now()),new BigDecimal("10"),
                Map.of("REF-case",new BigDecimal("10")),Map.of()).success()).isTrue();
        verify(gateway,never()).createRefund(any(),any());
    }
    @Test void observingConfirmedPartialProofNeverListsOrCreatesAnotherRefund() throws Exception {
        refund.setAmount(1000L); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThat(service.observeConfirmed(context("re_test",LocalDateTime.now().minusMonths(2)),BigDecimal.TEN).success()).isTrue();
        verify(gateway,never()).listPaymentRefunds(any()); verify(gateway,never()).createRefund(any(),any());
        when(gateway.retrieveRefund("re_test")).thenReturn(null);
        assertThatThrownBy(()->service.observeConfirmed(context("re_test",LocalDateTime.now()),BigDecimal.TEN)).hasMessageContaining("aucune nouvelle émission");
        assertThatThrownBy(()->service.observeConfirmed(context(null,LocalDateTime.now()),BigDecimal.TEN)).hasMessageContaining("aucune émission autorisée");
        verify(gateway,never()).createRefund(any(),any());
    }
    @Test void disputeArrivingAfterLocalDecisionPreventsNewRefund() throws Exception {
        gateway.retrieveCharge("ch_test").setDisputed(true);
        assertThatThrownBy(() -> service.execute(context(null, LocalDateTime.now()), amount))
                .hasMessageContaining("contestée");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void existingRefundIsStillReconciledAfterDisputeArrives() throws Exception {
        gateway.retrieveCharge("ch_test").setDisputed(true);
        when(gateway.findPaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThat(service.execute(context(null, LocalDateTime.now()), amount).success()).isTrue();
        verify(gateway, never()).createRefund(any(), any());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"won","lost","not-refundable","not-reinstated"})
    void permanentDisputedMarkerRequiresAReleasedAndRefundableCase(String scenario) throws Exception {
        gateway.retrieveCharge("ch_test").setDisputed(true);
        var dispute=new com.stripe.model.Dispute(); dispute.setId("du_test"); dispute.setCharge("ch_test");
        dispute.setPaymentIntent("pi_test"); dispute.setLivemode(false); dispute.setCurrency("eur");
        dispute.setStatus(scenario.equals("lost")?"lost":"won"); dispute.setIsChargeRefundable(!scenario.equals("not-refundable"));
        var debit=new com.stripe.model.BalanceTransaction();debit.setId("txn_debit");debit.setAmount(-3500L);debit.setCurrency("eur");
        var credit=new com.stripe.model.BalanceTransaction();credit.setId("txn_credit");credit.setAmount(3500L);credit.setCurrency("eur");
        dispute.setBalanceTransactions(scenario.equals("not-reinstated")?java.util.List.of(debit):java.util.List.of(debit,credit));
        when(gateway.disputesForCharge("ch_test")).thenReturn(java.util.List.of(dispute));
        if(scenario.equals("won")) {
            when(gateway.createRefund(any(),any())).thenReturn(refund);when(gateway.retrieveRefund("re_test")).thenReturn(refund);
            assertThat(service.execute(context(null,LocalDateTime.now()),amount).success()).isTrue();
        } else {
            assertThatThrownBy(()->service.execute(context(null,LocalDateTime.now()),amount)).hasMessageContaining("contestée");
            verify(gateway,never()).createRefund(any(),any());
        }
    }
    @Test void newDecisionHasStableKeyAndMetadataAndRereadsCurrentObject() throws Exception {
        when(gateway.createRefund(any(), eq("baitly-refund-REF-case"))).thenReturn(refund);
        when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThat(service.execute(context(null, LocalDateTime.now()), amount).status()).isEqualTo("REFUNDED");
        var params = org.mockito.ArgumentCaptor.forClass(com.stripe.param.RefundCreateParams.class);
        verify(gateway).createRefund(params.capture(), eq("baitly-refund-REF-case"));
        assertThat(params.getValue().getAmount()).isEqualTo(3500L);
        assertThat(params.getValue().getMetadata()).isEqualTo(Map.of(
                "organizationId", "7", "baitly_refund_ref", "REF-case", "originalTransactionRef", "TX-original"));
    }
    @ParameterizedTest @ValueSource(strings={"pending", "requires_action", "unknown"})
    void pendingNeverMeansRefunded(String state) throws Exception {
        refund.setStatus(state); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        var result = service.execute(context("re_test", LocalDateTime.now()), amount);
        assertThat(result.success()).isFalse(); assertThat(result.status()).isEqualTo("REFUND_PENDING");
        assertThat(result.providerTxId()).isEqualTo("re_test");
        verify(gateway, never()).createRefund(any(), any());
    }
    @ParameterizedTest @ValueSource(strings={"failed", "canceled"})
    void terminalRefusalKeepsProof(String state) throws Exception {
        refund.setStatus(state); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThat(service.execute(context("re_test", LocalDateTime.now()), amount).status()).isEqualTo("REFUND_REJECTED");
    }
    @Test void oldUnresolvedDecisionIsNotReemittedAfterIdempotencyWindow() throws Exception {
        assertThatThrownBy(() -> service.execute(context(null, LocalDateTime.now().minusHours(24)), amount))
                .hasMessageContaining("Délai");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void anotherOrganizationCannotConfirm() throws Exception {
        refund.setMetadata(Map.of("baitly_refund_ref", "REF-case", "originalTransactionRef", "TX-original", "organizationId", "9"));
        when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThatThrownBy(() -> service.execute(context("re_test", LocalDateTime.now()), amount)).hasMessageContaining("incohérente");
    }
    @Test void partialProviderRefundCannotConfirmFullDecision() throws Exception {
        refund.setAmount(1000L); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThatThrownBy(() -> service.execute(context("re_test", LocalDateTime.now()), amount)).hasMessageContaining("incohérente");
    }
    @Test void anotherIntentCannotConfirm() throws Exception {
        refund.setPaymentIntent("pi_other"); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThatThrownBy(() -> service.execute(context("re_test", LocalDateTime.now()), amount)).hasMessageContaining("incohérente");
    }
    @Test void wrongCurrencyDoesNotEmit() throws Exception {
        session.setCurrency("usd");
        assertThatThrownBy(() -> service.execute(context(null, LocalDateTime.now()), amount)).hasMessageContaining("preuve Stripe");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void unpaidSessionDoesNotEmit() throws Exception {
        session.setPaymentStatus("unpaid");
        assertThatThrownBy(() -> service.execute(context(null, LocalDateTime.now()), amount)).hasMessageContaining("preuve Stripe");
        verify(gateway, never()).createRefund(any(), any());
    }

    @Test void cancellationChecksOriginalReceiptButEmitsOnlyTheFrozenPolicyAmount() throws Exception {
        refund.setAmount(1750L);
        when(gateway.createRefund(any(), eq("baitly-refund-REF-case"))).thenReturn(refund);
        when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        assertThat(service.executeCancellation(context(null, LocalDateTime.now()), new BigDecimal("17.50")).success()).isTrue();
        var params = org.mockito.ArgumentCaptor.forClass(com.stripe.param.RefundCreateParams.class);
        verify(gateway).createRefund(params.capture(), eq("baitly-refund-REF-case"));
        assertThat(params.getValue().getAmount()).isEqualTo(1750L);
        verify(gateway).findExclusivePaymentRefund("pi_test", "REF-case");
    }
    @Test void cancellationRecoversAnOldProofWithoutEmittingAgain() throws Exception {
        refund.setAmount(1750L); when(gateway.findExclusivePaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThat(service.executeCancellation(context(null, LocalDateTime.now().minusDays(5)), new BigDecimal("17.50")).success()).isTrue();
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void webhookForUnknownRefundCannotTriggerAnEmission() throws Exception {
        assertThatThrownBy(() -> service.executeCancellation(context("re_absent", LocalDateTime.now()), amount)).hasMessageContaining("introuvable");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void conflictingRefundPreventsCancellationPayment() throws Exception {
        when(gateway.findExclusivePaymentRefund("pi_test", "REF-case")).thenThrow(new IllegalStateException("Remboursement externe"));
        assertThatThrownBy(() -> service.executeCancellation(context(null, LocalDateTime.now()), amount)).hasMessageContaining("externe");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void timedOutCancellationEmissionIsRecoveredUnderSameDecision() throws Exception {
        when(gateway.createRefund(any(), any())).thenThrow(new IllegalStateException("network timeout"));
        assertThatThrownBy(() -> service.executeCancellation(context(null, LocalDateTime.now()), amount)).hasMessageContaining("timeout");
        when(gateway.findExclusivePaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThat(service.executeCancellation(context(null, LocalDateTime.now()), amount).success()).isTrue();
        verify(gateway, times(1)).createRefund(any(), eq("baitly-refund-REF-case"));
    }
    @ParameterizedTest @ValueSource(strings={"pending", "requires_action", "failed", "canceled"})
    void cancellationNeverConfirmsANonSucceededProof(String state) throws Exception {
        refund.setStatus(state); when(gateway.findExclusivePaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThat(service.executeCancellation(context(null, LocalDateTime.now()), amount).success()).isFalse();
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void cancellationDoesNotTrustStaleWebhookIdentity() throws Exception {
        when(gateway.findExclusivePaymentRefund("pi_test", "REF-case")).thenReturn(refund);
        assertThatThrownBy(() -> service.executeCancellation(context("re_other", LocalDateTime.now()), amount)).hasMessageContaining("incohérente");
        verify(gateway, never()).createRefund(any(), any());
    }
    @Test void cancellationDoesNotReemitAnUnresolvedDecisionAfterStripeIdempotencyWindow() throws Exception {
        assertThatThrownBy(() -> service.executeCancellation(context(null, LocalDateTime.now().minusHours(24)), amount)).hasMessageContaining("Délai");
        verify(gateway, never()).createRefund(any(), any());
    }

    @Test void allocationEmitsOnlyItsShareAlongsideAnotherKnownRefund() throws Exception {
        var sibling = new Refund(); sibling.setId("re_sibling"); sibling.setAmount(2000L); sibling.setCurrency("eur");
        sibling.setPaymentIntent("pi_test"); sibling.setStatus("succeeded");
        sibling.setMetadata(Map.of("baitly_refund_ref","REF-sibling","organizationId","7","originalTransactionRef","TX-original"));
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of(sibling));
        refund.setAmount(1500L);
        when(gateway.createRefund(any(),any())).thenReturn(refund); when(gateway.retrieveRefund("re_test")).thenReturn(refund);
        var decisions=Map.of("REF-case",new BigDecimal("15"),"REF-sibling",new BigDecimal("20"));
        assertThat(service.executeAllocation(context(null,LocalDateTime.now()),new BigDecimal("15"),decisions).success()).isTrue();
        var params=org.mockito.ArgumentCaptor.forClass(com.stripe.param.RefundCreateParams.class);
        verify(gateway).createRefund(params.capture(),eq("baitly-refund-REF-case"));
        assertThat(params.getValue().getAmount()).isEqualTo(1500L);
    }

    @ParameterizedTest @ValueSource(strings={"pending","succeeded","failed","canceled"})
    void allocationRetryReadsTheSameCanonicalRefundWithoutNewEmission(String status) throws Exception {
        refund.setAmount(1500L); refund.setStatus(status);
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(java.util.List.of(refund));
        var result=service.executeAllocation(context("re_test",LocalDateTime.now().minusDays(2)),new BigDecimal("15"),Map.of("REF-case",new BigDecimal("15")));
        assertThat(result.success()).isEqualTo(status.equals("succeeded"));
        verify(gateway,never()).createRefund(any(),any());
    }

    @ParameterizedTest @ValueSource(strings={"unknown","no-metadata","org","amount","duplicate","over-budget","missing-proof"})
    void uncertainStripeAllocationHistoryNeverTriggersAnotherRefund(String scenario) throws Exception {
        refund.setAmount(1500L);
        var decisions=new java.util.HashMap<>(Map.of("REF-case",new BigDecimal("15")));
        switch (scenario) {
            case "unknown" -> refund.setMetadata(Map.of("baitly_refund_ref","REF-external"));
            case "no-metadata" -> refund.setMetadata(null);
            case "org" -> refund.setMetadata(Map.of("baitly_refund_ref","REF-case","organizationId","8","originalTransactionRef","TX-original"));
            case "amount" -> refund.setAmount(1400L);
            case "over-budget" -> decisions.put("REF-sibling",new BigDecimal("30"));
        }
        when(gateway.listPaymentRefunds("pi_test")).thenReturn(scenario.equals("missing-proof") ? java.util.List.of()
                : scenario.equals("duplicate") ? java.util.List.of(refund,refund) : java.util.List.of(refund));
        assertThatThrownBy(() -> service.executeAllocation(context("re_test",LocalDateTime.now()),new BigDecimal("15"),decisions))
            .isInstanceOf(IllegalStateException.class);
        verify(gateway,never()).createRefund(any(),any());
    }
}
