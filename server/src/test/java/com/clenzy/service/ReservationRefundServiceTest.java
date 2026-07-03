package com.clenzy.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Remboursement initie par le gestionnaire (T-10) — les tests « argent » :
 * ownership explicite (findById contourne le filtre tenant), refus OTA (pas de
 * cash chez nous), montant JAMAIS client-trusted (cross-check politique pour
 * CANCELLATION, plafond cash encaisse pour GESTURE — credit fidelite deduit),
 * idempotence derivee des parametres approuves.
 */
@ExtendWith(MockitoExtension.class)
class ReservationRefundServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private CancellationRefundService cancellationRefundService;
    @Mock private StripeService stripeService;

    private ReservationRefundService service() {
        return new ReservationRefundService(reservationRepository, cancellationRefundService, stripeService);
    }

    private static Reservation reservation(Long orgId, String sessionId,
                                           String total, String creditApplied) {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setStripeSessionId(sessionId);
        reservation.setTotalPrice(new BigDecimal(total));
        if (creditApplied != null) {
            reservation.setCreditApplied(new BigDecimal(creditApplied));
        }
        return reservation;
    }

    private static CancellationRefundPreviewDto preview(String refundAmount) {
        return new CancellationRefundPreviewDto(1L, "FLEXIBLE", 100,
                new BigDecimal(refundAmount), BigDecimal.ZERO, "EUR", 12, true,
                "Politique flexible : remboursement integral");
    }

    @Test
    void crossOrgReservation_isRefused_beforeAnyStripeCall() {
        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation(99L, "cs_1", "300.00", null)));

        assertThatThrownBy(() -> service().initiateRefund(1L, null,
                ReservationRefundService.REASON_CANCELLATION, 42L))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoStripeCall();
    }

    @Test
    void otaReservation_withoutStripeSession_isRefused() {
        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation(42L, null, "300.00", null)));

        assertThatThrownBy(() -> service().initiateRefund(1L, null,
                ReservationRefundService.REASON_CANCELLATION, 42L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OTA");
        verifyNoStripeCall();
    }

    @Test
    void alreadyRefunded_isRefused() {
        Reservation refunded = reservation(42L, "cs_1", "300.00", null);
        refunded.setPaymentStatus(PaymentStatus.REFUNDED);
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(refunded));

        assertThatThrownBy(() -> service().initiateRefund(1L, 5000L,
                ReservationRefundService.REASON_GESTURE, 42L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deja rembours");
        verifyNoStripeCall();
    }

    @Test
    void cancellation_usesPolicyAmount_computedServerSide() throws Exception {
        Reservation resa = reservation(42L, "cs_1", "300.00", null);
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(resa));
        when(cancellationRefundService.computePreview(resa, 42L)).thenReturn(preview("240.00"));

        var outcome = service().initiateRefund(1L, null,
                ReservationRefundService.REASON_CANCELLATION, 42L);

        assertThat(outcome.amountCents()).isEqualTo(24000L);
        verify(stripeService).refundCheckoutSessionPartial(eq("cs_1"), eq(24000L),
                eq("agent-refund-1-cancellation-24000"), anyString());
    }

    @Test
    void cancellation_providedAmountMismatchingPolicy_isRefused() {
        Reservation resa = reservation(42L, "cs_1", "300.00", null);
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(resa));
        when(cancellationRefundService.computePreview(resa, 42L)).thenReturn(preview("240.00"));

        assertThatThrownBy(() -> service().initiateRefund(1L, 30000L,
                ReservationRefundService.REASON_CANCELLATION, 42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ecart de montant");
        verifyNoStripeCall();
    }

    @Test
    void gesture_isCappedByCashActuallyPaid_creditDeducted() {
        // Total 300, credit fidelite 100 → cash encaisse 200 : un geste de 250 est refuse.
        Reservation resa = reservation(42L, "cs_1", "300.00", "100.00");
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(resa));

        assertThatThrownBy(() -> service().initiateRefund(1L, 25000L,
                ReservationRefundService.REASON_GESTURE, 42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("superieur au");
        verifyNoStripeCall();
    }

    @Test
    void gesture_withinCash_succeeds() throws Exception {
        Reservation resa = reservation(42L, "cs_1", "300.00", "100.00");
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(resa));

        var outcome = service().initiateRefund(1L, 5000L,
                ReservationRefundService.REASON_GESTURE, 42L);

        assertThat(outcome.amountCents()).isEqualTo(5000L);
        verify(stripeService).refundCheckoutSessionPartial(eq("cs_1"), eq(5000L),
                eq("agent-refund-1-gesture-5000"), anyString());
    }

    @Test
    void gesture_withoutAmount_isRefused() {
        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation(42L, "cs_1", "300.00", null)));

        assertThatThrownBy(() -> service().initiateRefund(1L, null,
                ReservationRefundService.REASON_GESTURE, 42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("requis");
        verifyNoStripeCall();
    }

    private void verifyNoStripeCall() {
        try {
            verify(stripeService, never()).refundCheckoutSessionPartial(anyString(), anyLong(), anyString(), anyString());
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }
}
