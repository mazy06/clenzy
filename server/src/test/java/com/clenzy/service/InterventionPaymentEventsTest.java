package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.email.BookingConfirmationEmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class InterventionPaymentEventsTest {
    @Mock InterventionRepository interventionRepository;
    @Mock ReservationRepository reservationRepository;
    @Mock ServiceRequestRepository serviceRequestRepository;
    @Mock NotificationService notificationService;
    @Mock ServiceRequestService serviceRequestService;
    @Mock WalletService walletService;
    @Mock LedgerService ledgerService;
    @Mock SplitPaymentService splitPaymentService;
    @Mock AutoInvoiceService autoInvoiceService;
    @Mock DocumentGenerationOutbox documentOutbox;
    @Mock PaymentStatusTransitionService paymentStatusTransitionService;
    @Mock BookingConfirmationEmailService bookingConfirmationEmailService;
    @Mock WebhookEventPublisher webhookEventPublisher;
    @InjectMocks StripePaymentConfirmationService service;

    private Intervention mission(long id, PaymentStatus status) {
        var mission = new Intervention();
        mission.setId(id);
        mission.setStripeSessionId("session");
        mission.setPaymentStatus(status);
        mission.setStatus(InterventionStatus.AWAITING_PAYMENT);
        return mission;
    }

    @Test void confirmationReloadsCancellationBeforeSaving() {
        var mission = mission(1, PaymentStatus.PROCESSING);
        when(interventionRepository.findByStripeSessionId("session")).thenReturn(Optional.of(mission));
        doAnswer(invocation -> { mission.setStatus(InterventionStatus.CANCELLED); return null; })
                .when(paymentStatusTransitionService).lockInterventionPayments(List.of(mission));
        when(paymentStatusTransitionService.markInterventionPaid(1L)).thenReturn(true);
        service.confirmPayment("session");
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        verify(notificationService, never()).notifyAdminsAndManagers(
                eq(NotificationKey.INTERVENTION_AWAITING_VALIDATION), anyString(), anyString(), anyString());
        var order = inOrder(paymentStatusTransitionService, interventionRepository);
        order.verify(paymentStatusTransitionService).lockInterventionPayments(List.of(mission));
        order.verify(paymentStatusTransitionService).markInterventionPaid(1L);
        order.verify(interventionRepository).save(mission);
    }

    @ParameterizedTest @EnumSource(value = PaymentStatus.class, names = {"PAID", "PARTIALLY_PAID", "REFUNDED"})
    void lateFailurePreservesCollectedMoney(PaymentStatus status) {
        var mission = mission(1, status);
        when(interventionRepository.findByStripeSessionId("session")).thenReturn(Optional.of(mission));
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(mission));
        service.markPaymentAsFailed("session");
        service.markGroupedPaymentAsFailed("session", "1");
        assertThat(mission.getPaymentStatus()).isEqualTo(status);
        verify(interventionRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test void failureOfPreviousGroupCannotFailNewSession() {
        var mission = mission(1, PaymentStatus.PROCESSING);
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(mission));
        service.markGroupedPaymentAsFailed("old-session", "1");
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
        verify(interventionRepository, never()).save(any());
    }

    @Test void groupChecksEverySessionBeforeRecordingAnyPayment() {
        var first = mission(1, PaymentStatus.PROCESSING);
        var second = mission(2, PaymentStatus.PROCESSING);
        second.setStripeSessionId("new-session");
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(first));
        when(interventionRepository.findById(2L)).thenReturn(Optional.of(second));
        assertThatThrownBy(() -> service.confirmGroupedPayment("session", "2,1,2"))
                .isInstanceOf(IllegalStateException.class);
        verify(paymentStatusTransitionService).lockInterventionPayments(List.of(first, second));
        verify(paymentStatusTransitionService, never()).markInterventionPaid(any());
        verify(interventionRepository, never()).save(any());
    }

    @Test void replayCannotRestoreRefundedGroupToPaid() {
        var mission = mission(1, PaymentStatus.REFUNDED);
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(mission));
        service.confirmGroupedPayment("session", "1,1");
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(paymentStatusTransitionService, never()).markInterventionPaid(any());
        verifyNoInteractions(documentOutbox, ledgerService);
    }

    @Test void deliveredMissionDoesNotReopenCancelledRequest() {
        var mission = mission(1, PaymentStatus.PROCESSING);
        mission.setCompletedAt(java.time.LocalDateTime.now());
        var request = new ServiceRequest();
        request.setStatus(RequestStatus.CANCELLED);
        mission.setServiceRequest(request);
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(mission));
        when(paymentStatusTransitionService.markInterventionPaid(1L)).thenReturn(true);
        service.confirmGroupedPayment("session", "1");
        assertThat(request.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        verify(serviceRequestRepository, never()).save(any());
    }
}
