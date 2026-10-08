package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterventionRefundReconciliationServiceTest {
    @Mock PaymentTransactionRepository payments;
    @Mock InterventionPaymentCoordination coordination;
    @Mock PaymentStatusTransitionService transitions;
    @Mock PaymentLedgerReversalService ledger;
    @Mock TenantContext tenant;
    InterventionRefundReconciliationService service;
    PaymentTransaction refund;
    PaymentTransaction original;
    Intervention mission;

    @BeforeEach
    void setup() {
        service = new InterventionRefundReconciliationService(payments, coordination, transitions, ledger, tenant, mock(BaitlyBatchRefundPersistence.class));
        original = transaction("TX-test", TransactionType.CHECKOUT);
        original.setProviderTxId("cs_test_original");
        refund = transaction("REF-test", TransactionType.REFUND);
        refund.setMetadata(Map.of("originalTransactionRef", "TX-test"));
        mission = new Intervention();
        mission.setId(405L);
        mission.setEstimatedCost(new BigDecimal("35.00"));
        mission.setStripeSessionId("cs_test_original");
        when(payments.findByTransactionRef("REF-test")).thenReturn(Optional.of(refund));
        lenient().when(payments.findByTransactionRef("TX-test")).thenReturn(Optional.of(original));
        lenient().when(tenant.getRequiredOrganizationId()).thenReturn(2L);
        lenient().when(coordination.lockMission(2L, 405L)).thenReturn(mission);
    }

    private PaymentTransaction transaction(String ref, TransactionType type) {
        var tx = new PaymentTransaction();
        tx.setTransactionRef(ref); tx.setOrganizationId(2L); tx.setSourceId(405L);
        tx.setSourceType("INTERVENTION"); tx.setPaymentType(type);
        tx.setStatus(TransactionStatus.COMPLETED); tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setAmount(new BigDecimal("35.00")); tx.setCurrency("EUR");
        return tx;
    }

    @Test void confirmedFullRefundUpdatesStatusAndReversesLedger() {
        service.reconcile("REF-test");
        verify(transitions).markInterventionRefunded(405L);
        verify(ledger).reverseInterventionPaymentEntries(405L);
    }
    @Test void failedRefundDoesNotChangeTheMission() {
        refund.setStatus(TransactionStatus.FAILED);
        service.reconcile("REF-test");
        verifyNoInteractions(coordination, transitions, ledger);
    }
    @Test void partialRefundDoesNotMarkTheWholeMissionRefunded() {
        refund.setAmount(BigDecimal.TEN);
        service.reconcile("REF-test");
        verifyNoInteractions(coordination, transitions, ledger);
    }
    @Test void crossTenantOriginalPaymentIsRejected() {
        original.setOrganizationId(3L);
        assertThatThrownBy(() -> service.reconcile("REF-test")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transitions, ledger);
    }
    @Test void mismatchedSourceIsRejected() {
        original.setSourceId(999L);
        assertThatThrownBy(() -> service.reconcile("REF-test")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transitions, ledger);
    }
    @Test void staleCheckoutCannotRefundANewerPaymentCycle() {
        mission.setStripeSessionId("cs_test_new");
        assertThatThrownBy(() -> service.reconcile("REF-test")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transitions, ledger);
    }
    @Test void ledgerFailurePropagatesForOutboxRetry() {
        doThrow(new IllegalStateException("ledger unavailable")).when(ledger).reverseInterventionPaymentEntries(405L);
        assertThatThrownBy(() -> service.reconcile("REF-test")).hasMessage("ledger unavailable");
    }
}
