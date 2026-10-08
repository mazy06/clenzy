package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AllocatedPaymentConfirmationTest {
    @Mock InterventionRepository interventions;
    @Mock ReservationRepository reservations;
    @Mock ServiceRequestRepository requests;
    @Mock NotificationService notifications;
    @Mock ServiceRequestService serviceRequests;
    @Mock WalletService wallets;
    @Mock LedgerService ledger;
    @Mock SplitPaymentService splits;
    @Mock AutoInvoiceService invoices;
    @Mock DocumentGenerationOutbox documents;
    @Mock PaymentStatusTransitionService transitions;
    @Mock com.clenzy.service.email.BookingConfirmationEmailService emails;
    @Mock WebhookEventPublisher events;
    @InjectMocks StripePaymentConfirmationService confirmation;

    final PaymentTransaction tx = InterventionBatchCheckoutServiceTest.batch();
    final List<InterventionPaymentAllocation> parts = List.of(new InterventionPaymentAllocation(tx,1L,new BigDecimal("30")),
            new InterventionPaymentAllocation(tx,2L,new BigDecimal("50")));
    Intervention mission(long id) {
        var mission = new Intervention(); mission.setId(id); mission.setOrganizationId(7L);
        mission.setStatus(InterventionStatus.AWAITING_PAYMENT); mission.setStripeSessionId("cs_batch");
        mission.setEstimatedCost(new BigDecimal("999")); mission.setPaymentStatus(PaymentStatus.PROCESSING);
        when(interventions.findById(id)).thenReturn(Optional.of(mission)); return mission;
    }
    @Test void exactAmountsAreRecordedOnceEvenWhenCurrentEstimatesDiffer() {
        tx.setStatus(TransactionStatus.COMPLETED);
        var first = mission(1); var second = mission(2);
        when(transitions.markInterventionPaid(anyLong())).thenReturn(true);
        var platform = new Wallet(); var escrow = new Wallet();
        when(wallets.getOrCreatePlatformWallet(7L,"EUR")).thenReturn(platform);
        when(wallets.getOrCreateEscrowWallet(7L,"EUR")).thenReturn(escrow);
        confirmation.confirmAllocatedPayment(tx,parts);
        confirmation.confirmAllocatedPayment(tx,parts);
        verify(ledger).recordTransfer(eq(escrow),eq(platform),eq(new BigDecimal("30.00")),eq(LedgerReferenceType.PAYMENT),eq("TX-batch:1"),anyString());
        verify(ledger).recordTransfer(eq(escrow),eq(platform),eq(new BigDecimal("50.00")),eq(LedgerReferenceType.PAYMENT),eq("TX-batch:2"),anyString());
        verifyNoMoreInteractions(ledger);
        assertThat(parts).allMatch(p -> p.getConfirmedAt()!=null);
        assertThat(first.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(second.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        verifyNoInteractions(notifications,emails);
    }
    @Test void everyMissionIsCheckedBeforeFirstLedgerEntry() {
        tx.setStatus(TransactionStatus.COMPLETED); mission(1); mission(2).setStripeSessionId("cs_other");
        assertThatThrownBy(() -> confirmation.confirmAllocatedPayment(tx,parts)).hasMessageContaining("session");
        verify(transitions,never()).markInterventionPaid(anyLong());
        verifyNoInteractions(ledger, wallets, documents);
    }
    @Test void ledgerFailurePropagatesForTransactionalRollbackAndRedelivery() {
        tx.setStatus(TransactionStatus.COMPLETED); mission(1); mission(2);
        when(transitions.markInterventionPaid(1L)).thenReturn(true);
        doThrow(new IllegalStateException("ledger unavailable")).when(ledger).recordTransfer(any(),any(),any(),any(),anyString(),anyString());
        assertThatThrownBy(() -> confirmation.confirmAllocatedPayment(tx,parts)).hasMessage("ledger unavailable");
        assertThat(parts).allMatch(p -> p.getConfirmedAt()==null);
        verifyNoInteractions(splits,documents);
        verify(transitions,never()).markInterventionPaid(2L);
    }
    @Test void unconfirmedTransactionCannotMarkMissionPaid() {
        assertThatThrownBy(() -> confirmation.confirmAllocatedPayment(tx,parts)).hasMessageContaining("non confirmé");
        verifyNoInteractions(interventions,ledger,transitions);
    }
}
