package com.clenzy.booking.service;

import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.BookingPendingReservationRepository;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.StripeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PendingReservationCleanupSchedulerTest {

    private static final Long ORG_ID = 10L;

    @Mock private BookingPendingReservationRepository pendingReservationRepository;
    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private CalendarEngine calendarEngine;
    @Mock private StripeService stripeService;
    @Mock private com.clenzy.service.AbandonedBookingService abandonedBookingService;
    @Mock private PlatformTransactionManager transactionManager;

    private PendingReservationCleanupScheduler scheduler;

    @BeforeEach
    void setUp() {
        // TransactionTemplate reel sur un manager mocke : la callback s'execute
        // immediatement (transaction independante par reservation).
        lenient().when(transactionManager.getTransaction(any()))
            .thenReturn(new SimpleTransactionStatus());
        // Pas de duree de hold configuree pour l'org → defaut systeme (30 min).
        lenient().when(configRepository.findFirstByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
        scheduler = new PendingReservationCleanupScheduler(
            pendingReservationRepository, configRepository, calendarEngine, stripeService, abandonedBookingService, transactionManager);
    }

    private Reservation buildExpiredReservation(Long id, String stripeSessionId) {
        Reservation reservation = new Reservation();
        reservation.setId(id);
        reservation.setOrganizationId(ORG_ID);
        reservation.setConfirmationCode("RES-EXP" + id);
        reservation.setStatus("pending");
        reservation.setPaymentStatus(PaymentStatus.PENDING);
        reservation.setStripeSessionId(stripeSessionId);
        // Créée il y a 60 min → expirée pour le défaut de 30 min (filtre par-org du scheduler).
        reservation.setCreatedAt(LocalDateTime.now().minusMinutes(60));
        Property property = new Property();
        property.setId(42L);
        reservation.setProperty(property);
        return reservation;
    }

    @Test
    @DisplayName("Z4A-BUGS-02: session expired on Stripe → reservation cancelled and calendar released")
    void whenSessionExpired_thenCancelsAndReleasesCalendar() {
        Reservation reservation = buildExpiredReservation(1L, "cs_open");
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));
        when(stripeService.expireCheckoutSession("cs_open"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.EXPIRED);

        scheduler.cleanupExpiredPendingReservations();

        assertThat(reservation.getStatus()).isEqualTo("cancelled");
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.CANCELLED);
        verify(pendingReservationRepository).save(reservation);
        verify(calendarEngine).cancel(1L, ORG_ID, "booking-engine-cleanup");
    }

    @Test
    @DisplayName("Z4A-BUGS-02: session already PAID → reconciled, calendar NOT released")
    void whenSessionAlreadyPaid_thenReconcilesWithoutReleasingCalendar() {
        Reservation reservation = buildExpiredReservation(2L, "cs_paid");
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));
        when(stripeService.expireCheckoutSession("cs_paid"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.PAID);

        scheduler.cleanupExpiredPendingReservations();

        // Reconciliation : confirmation du paiement, aucune annulation ni liberation
        verify(stripeService).confirmReservationPayment("cs_paid");
        assertThat(reservation.getStatus()).isEqualTo("pending");
        verify(pendingReservationRepository, never()).save(any(Reservation.class));
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("Stripe unreachable → reservation kept for next run, nothing released")
    void whenStripeUnavailable_thenSkipsReservationUntilNextRun() {
        Reservation reservation = buildExpiredReservation(3L, "cs_unknown");
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));
        when(stripeService.expireCheckoutSession("cs_unknown"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.FAILED);

        scheduler.cleanupExpiredPendingReservations();

        verify(pendingReservationRepository, never()).save(any(Reservation.class));
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
        verify(stripeService, never()).confirmReservationPayment(anyString());
    }

    @Test
    @DisplayName("async payment in progress (COMPLETED_UNPAID) → nothing released")
    void whenAsyncPaymentInProgress_thenSkipsReservation() {
        Reservation reservation = buildExpiredReservation(4L, "cs_async");
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));
        when(stripeService.expireCheckoutSession("cs_async"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.COMPLETED_UNPAID);

        scheduler.cleanupExpiredPendingReservations();

        verify(pendingReservationRepository, never()).save(any(Reservation.class));
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("no Stripe session attached → cancelled directly")
    void whenNoStripeSession_thenCancelsDirectly() {
        Reservation reservation = buildExpiredReservation(5L, null);
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));

        scheduler.cleanupExpiredPendingReservations();

        assertThat(reservation.getStatus()).isEqualTo("cancelled");
        verify(pendingReservationRepository).save(reservation);
        verify(calendarEngine).cancel(5L, ORG_ID, "booking-engine-cleanup");
        verify(stripeService, never()).expireCheckoutSession(anyString());
    }

    @Test
    @DisplayName("failure on one reservation does not block the others")
    void whenOneReservationFails_thenOthersStillProcessed() {
        Reservation failing = buildExpiredReservation(6L, "cs_a");
        Reservation ok = buildExpiredReservation(7L, "cs_b");
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(failing, ok));
        when(stripeService.expireCheckoutSession("cs_a"))
            .thenThrow(new RuntimeException("boom"));
        when(stripeService.expireCheckoutSession("cs_b"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.EXPIRED);

        scheduler.cleanupExpiredPendingReservations();

        assertThat(ok.getStatus()).isEqualTo("cancelled");
        verify(calendarEngine).cancel(eq(7L), eq(ORG_ID), anyString());
        verify(calendarEngine, never()).cancel(eq(6L), anyLong(), anyString());
    }

    @Test
    @DisplayName("reliquat A3: a pending hold with FAILED payment is also collected and released")
    void whenPaymentFailed_thenHoldIsReleased() {
        Reservation reservation = buildExpiredReservation(8L, "cs_failed_pay");
        reservation.setPaymentStatus(PaymentStatus.FAILED);
        when(pendingReservationRepository.findUnpaidHolds())
            .thenReturn(List.of(reservation));
        when(stripeService.expireCheckoutSession("cs_failed_pay"))
            .thenReturn(StripeService.CheckoutSessionExpiryResult.EXPIRED);

        scheduler.cleanupExpiredPendingReservations();

        assertThat(reservation.getStatus()).isEqualTo("cancelled");
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.CANCELLED);
        verify(calendarEngine).cancel(8L, ORG_ID, "booking-engine-cleanup");
    }
}
