package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.stripe.model.Refund;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ManagedRefundReconciliationTest {
    PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    PaymentPersistence persistence = mock(PaymentPersistence.class);
    ManagedStripeRefund stripe = mock(ManagedStripeRefund.class);
    BaitlyBatchRefundPersistence allocations = mock(BaitlyBatchRefundPersistence.class);
    BaitlyExternalRefundReconciliation external = mock(BaitlyExternalRefundReconciliation.class);
    ManagedRefundReconciliation service = new ManagedRefundReconciliation(payments, persistence, stripe, mock(com.clenzy.booking.service.BookingCancellationRefundProcessor.class), allocations, external, mock(BaitlyRefundSeriesStore.class));
    PaymentTransaction original, refund;

    @BeforeEach void setup() {
        original = transaction("TX-original", TransactionType.CHECKOUT, TransactionStatus.COMPLETED);
        original.setProviderTxId("cs_original");
        refund = transaction("REF-case", TransactionType.REFUND, TransactionStatus.PROCESSING);
        refund.setMetadata(Map.of("managedRefund", true, "originalTransactionRef", "TX-original"));
        when(payments.findByTransactionRef("TX-original")).thenReturn(Optional.of(original));
        when(payments.findByTransactionRef("REF-case")).thenReturn(Optional.of(refund));
    }
    PaymentTransaction transaction(String ref, TransactionType type, TransactionStatus status) {
        var tx = new PaymentTransaction(); tx.setTransactionRef(ref); tx.setPaymentType(type); tx.setStatus(status);
        tx.setProviderType(PaymentProviderType.STRIPE); tx.setOrganizationId(7L);
        tx.setSourceType("INTERVENTION"); tx.setSourceId(3L); tx.setAmount(new BigDecimal("35.00"));
        tx.setCurrency("EUR");
        org.springframework.test.util.ReflectionTestUtils.setField(tx, "createdAt", LocalDateTime.now()); return tx;
    }
    Refund event() {
        var event = new Refund(); event.setId("re_test"); event.setStatus("succeeded");
        event.setAmount(1L); event.setCurrency("usd");
        event.setMetadata(Map.of("baitly_refund_ref", "REF-case")); return event;
    }
    @Test void webhookRereadsCanonicalProofInsteadOfTrustingSnapshot() throws Exception {
        var pending = new PaymentResult(false, "re_test", null, null, null, "REFUND_PENDING", "pending");
        when(stripe.execute(any(), any())).thenReturn(pending);
        service.onWebhook(event());
        var context = org.mockito.ArgumentCaptor.forClass(RefundContext.class);
        verify(stripe).execute(context.capture(), eq(new BigDecimal("35.00")));
        assertThat(context.getValue().orgId()).isEqualTo(7L);
        assertThat(context.getValue().providerRefundId()).isEqualTo("re_test");
        assertThat(context.getValue().providerTxId()).isEqualTo("cs_original");
        verify(persistence).finalizeRefund("REF-case", pending, 7L);
    }
    @Test void periodicRecoveryResumesDurableCaseWithoutBrowser() throws Exception {
        when(payments.findPendingStripeRefunds(any())).thenReturn(List.of(refund));
        var confirmed = PaymentResult.success("re_test", null, "REFUNDED");
        when(stripe.execute(any(), any())).thenReturn(confirmed);
        service.resumePending();
        verify(persistence).finalizeRefund("REF-case", confirmed, 7L);
    }
    @Test void recoveryFailureKeepsReservedCaseAndProcessesFollowingCase() throws Exception {
        var next = transaction("REF-next", TransactionType.REFUND, TransactionStatus.PROCESSING);
        next.setMetadata(refund.getMetadata());
        when(payments.findPendingStripeRefunds(any())).thenReturn(List.of(refund, next));
        var confirmed = PaymentResult.success("re_test", null, "REFUNDED");
        when(stripe.execute(any(), any())).thenThrow(new IllegalStateException("network")).thenReturn(confirmed);
        service.resumePending();
        verify(persistence).markRefundFailed("REF-case", "network");
        verify(persistence).finalizeRefund("REF-next", confirmed, 7L);
    }
    @Test void anotherTenantCannotUseOriginalPayment() {
        original.setOrganizationId(8L);
        assertThatThrownBy(() -> service.onWebhook(event())).hasMessageContaining("incohérents");
        verifyNoInteractions(stripe, persistence);
    }
    @Test void anotherRefundIdCannotReplaceStoredProof() {
        refund.setProviderTxId("re_other");
        assertThatThrownBy(() -> service.onWebhook(event())).hasMessageContaining("autre remboursement");
        verifyNoInteractions(stripe, persistence);
    }
    @Test void externalRefundIsNotAppliedToAnUnrelatedMission() throws Exception {
        var incoming = event(); incoming.setMetadata(Map.of());
        service.onWebhook(incoming);
        verify(external).onWebhook(incoming);
        verifyNoInteractions(stripe, persistence);
    }
    @Test void lateFailureAfterSuccessRequiresCounterEntryBeforeAcknowledgement() throws Exception {
        refund.setStatus(TransactionStatus.COMPLETED);
        when(stripe.execute(any(), any())).thenReturn(new PaymentResult(false, "re_test", null, null, null, "REFUND_REJECTED", "failed"));
        assertThatThrownBy(() -> service.onWebhook(event())).hasMessageContaining("contre-écritures");
        verifyNoInteractions(persistence);
    }
    void allocation() {
        original.setSourceType("INTERVENTION_BATCH"); original.setSourceId(1L); original.setAmount(new BigDecimal("80"));
        refund.setMetadata(Map.of("managedRefund",true,"originalTransactionRef","TX-original","batchAllocationId","11"));
        when(allocations.manifest(original)).thenReturn(Map.of("REF-case",new BigDecimal("35")));
    }
    @Test void allocatedRefundAfterExternalProofKeepsProofSeparateFromEmittableDecisions() throws Exception {
        allocation();
        when(allocations.externalManifest(original)).thenReturn(Map.of("re_external",new BigDecimal("5")));
        when(allocations.managedManifest(original)).thenReturn(Map.of("REF-case",new BigDecimal("35")));
        var confirmed=PaymentResult.success("re_test",null,"REFUNDED");
        when(stripe.executeSeries(any(),any(),anyMap(),anyMap())).thenReturn(confirmed);
        service.onWebhook(event());
        verify(stripe).executeSeries(any(),eq(new BigDecimal("35.00")),eq(Map.of("REF-case",new BigDecimal("35"))),eq(Map.of("re_external",new BigDecimal("5"))));
        verify(stripe,never()).executeAllocation(any(),any(),anyMap());
        verify(persistence).finalizeRefund("REF-case",confirmed,7L);
    }
    @Test void allocationWebhookAndWorkerUseOnlyTheValidatedLineAmount() throws Exception {
        allocation();
        var confirmed=PaymentResult.success("re_test",null,"REFUNDED");
        when(stripe.executeAllocation(any(),any(),anyMap())).thenReturn(confirmed);
        service.onWebhook(event());
        verify(allocations).validate(refund,original);
        var context=org.mockito.ArgumentCaptor.forClass(RefundContext.class);
        verify(stripe).executeAllocation(context.capture(),eq(new BigDecimal("35.00")),eq(Map.of("REF-case",new BigDecimal("35"))));
        assertThat(context.getValue().originalAmount()).isEqualByComparingTo("80");
        verify(persistence).finalizeRefund("REF-case",confirmed,7L);
        verify(stripe,never()).execute(any(),any());
    }
    @Test void allocationTimeoutKeepsDurableReservationForRecovery() throws Exception {
        allocation(); when(stripe.executeAllocation(any(),any(),anyMap())).thenThrow(new IllegalStateException("timeout"));
        when(persistence.markRefundFailed("REF-case","timeout")).thenReturn(refund);
        assertThat(service.resumeAllocation("REF-case",7L)).isSameAs(refund);
        verify(persistence,never()).finalizeRefund(any(),any(),any());
    }
    @Test void partialAllocationUsesWholeBatchManifestThenOnlyObservesConfirmedProof() throws Exception {
        allocation(); refund.setAmount(new BigDecimal("5"));
        var metadata=new HashMap<>(refund.getMetadata()); metadata.putAll(Map.of("cumulativeRefund",true,"refundBefore","0","refundAfter","5"));
        refund.setMetadata(metadata);
        var manifest=Map.of("REF-case",new BigDecimal("5"),"REF-sibling",new BigDecimal("45"));
        when(allocations.manifest(original)).thenReturn(manifest);
        var confirmed=PaymentResult.success("re_test",null,"REFUNDED");
        when(stripe.executeAllocation(any(),any(),anyMap())).thenReturn(confirmed);
        service.onWebhook(event());
        verify(stripe).executeAllocation(any(),eq(new BigDecimal("5")),eq(manifest));
        verify(stripe,never()).executeSeries(any(),any(),anyMap(),anyMap());
        refund.setStatus(TransactionStatus.COMPLETED); refund.setProviderTxId("re_test");
        when(stripe.observeConfirmed(any(),any())).thenReturn(confirmed);
        service.onWebhook(event());
        verify(stripe).observeConfirmed(any(),eq(new BigDecimal("5")));
        verify(stripe,times(1)).executeAllocation(any(),any(),anyMap());
    }
    @Test void allocationRetryCannotReadAnotherOrganization() {
        allocation();
        assertThatThrownBy(() -> service.resumeAllocation("REF-case",8L)).hasMessageContaining("inaccessible");
        verifyNoInteractions(stripe,persistence);
    }
    @Test void completedSeriesWebhookDoesNotWaitForTheNextRefundOrEmitAgain() throws Exception {
        refund.setId(2L); refund.setAmount(BigDecimal.TEN); refund.setProviderTxId("re_test");
        refund.setStatus(TransactionStatus.COMPLETED);
        refund.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"refundBefore","0","originalTransactionRef","TX-original"));
        var success=PaymentResult.success("re_test",null,"REFUNDED");
        when(stripe.observeConfirmed(any(),eq(BigDecimal.TEN))).thenReturn(success);
        service.onWebhook(event());
        verify(persistence).finalizeRefund("REF-case",success,7L);
        verify(payments,never()).findByOrganizationIdAndSourceTypeAndSourceId(any(),any(),any());
        verify(stripe,never()).executeSeries(any(),any(),any(),any());
    }
    @Test void completedSeriesStillRejectsAContradictoryCanonicalResult() throws Exception {
        refund.setAmount(BigDecimal.TEN); refund.setProviderTxId("re_test"); refund.setStatus(TransactionStatus.COMPLETED);
        refund.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"refundBefore","0","originalTransactionRef","TX-original"));
        when(stripe.observeConfirmed(any(),any())).thenReturn(new PaymentResult(false,"re_test",null,null,null,"REFUND_REJECTED","failed"));
        assertThatThrownBy(()->service.onWebhook(event())).hasMessageContaining("contre-écritures");
        verifyNoInteractions(persistence);
    }
    @Test void externalCumulativeProofCanNeverUseTheManagedEmitter() {
        refund.setMetadata(Map.of("externalRefund",true,"externalRefundConfirmed",true,"cumulativeRefund",true,
                "refundBefore","0","originalTransactionRef","TX-original"));
        assertThat(BaitlyRefundSeries.isSeries(refund)).isTrue();
        assertThatThrownBy(() -> service.resumeSeries("REF-case",7L)).hasMessageContaining("inaccessible");
        assertThatThrownBy(() -> service.reconcile(refund,"re_external")).hasMessageContaining("externe");
        verifyNoInteractions(stripe,persistence);
    }
}
