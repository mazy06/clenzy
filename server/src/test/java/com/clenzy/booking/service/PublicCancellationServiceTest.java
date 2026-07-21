package com.clenzy.booking.service;

import com.clenzy.booking.dto.CancellationResultDto;
import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.CancellationRefundService;
import com.clenzy.service.StripeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Annulation self-service (aperçu) : auth par code + email guest, anti-énumération (NotFound),
 * délégation au calculateur de remboursement.
 */
@ExtendWith(MockitoExtension.class)
class PublicCancellationServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private CancellationRefundService cancellationRefundService;
    @Mock private CalendarEngine calendarEngine;
    @Mock private StripeService stripeService;

    private PublicCancellationService service;

    private static final Long ORG = 7L;

    @BeforeEach
    void setUp() {
        service = new PublicCancellationService(reservationRepository, cancellationRefundService,
                calendarEngine, stripeService,
                org.mockito.Mockito.mock(com.clenzy.booking.service.GuestCreditService.class));
    }

    private static CancellationRefundPreviewDto sampleDto() {
        return new CancellationRefundPreviewDto(1L, "FLEXIBLE", 100,
                BigDecimal.valueOf(100), BigDecimal.ZERO, "EUR", 30L, true, "Remboursement intégral");
    }

    @Test
    void preview_matchingGuestEmail_returnsComputedPreview() {
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn("alice@example.com");
        Reservation reservation = mock(Reservation.class);
        when(reservation.getGuest()).thenReturn(guest);
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("ABC123", ORG))
                .thenReturn(Optional.of(reservation));
        CancellationRefundPreviewDto dto = sampleDto();
        when(cancellationRefundService.computePreview(reservation, ORG)).thenReturn(dto);

        // Email insensible à la casse / espaces.
        CancellationRefundPreviewDto result = service.preview(ORG, "ABC123", "  Alice@Example.com ");

        assertThat(result).isSameAs(dto);
    }

    @Test
    void preview_wrongEmail_throwsNotFoundAndDoesNotCompute() {
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn("alice@example.com");
        Reservation reservation = mock(Reservation.class);
        when(reservation.getGuest()).thenReturn(guest);
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("ABC123", ORG))
                .thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> service.preview(ORG, "ABC123", "bob@example.com"))
                .isInstanceOf(NotFoundException.class);

        verify(cancellationRefundService, never()).computePreview(any(), anyLong());
    }

    @Test
    void preview_codeNotFound_throwsNotFound() {
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("NOPE", ORG))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview(ORG, "NOPE", "alice@example.com"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void cancel_cancellableWithRefund_releasesCalendarMarksCancelledAndRefunds() throws Exception {
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn("alice@example.com");
        Reservation reservation = mock(Reservation.class);
        when(reservation.getGuest()).thenReturn(guest);
        when(reservation.getId()).thenReturn(1L);
        when(reservation.getStatus()).thenReturn("confirmed");
        when(reservation.getStripeSessionId()).thenReturn("cs_x");
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("ABC123", ORG))
                .thenReturn(Optional.of(reservation));
        CancellationRefundPreviewDto preview = new CancellationRefundPreviewDto(1L, "FLEXIBLE", 80,
                BigDecimal.valueOf(80), BigDecimal.valueOf(20), "EUR", 10L, true, "80% remboursé");
        when(cancellationRefundService.computePreview(reservation, ORG)).thenReturn(preview);

        CancellationResultDto result = service.cancel(ORG, "ABC123", "alice@example.com", "trop cher");

        assertThat(result.status()).isEqualTo("cancelled");
        assertThat(result.refundAmount()).isEqualByComparingTo("80");
        verify(calendarEngine).cancel(1L, ORG, null);
        verify(reservation).markCancelled();
        verify(reservationRepository).save(reservation);
        // afterCommit inline (pas de transaction en test) → remboursement partiel 80€ = 8000 u.m.
        verify(stripeService).refundCheckoutSessionPartial("cs_x", 8000L, "cancel-refund-1", "trop cher");
    }

    @Test
    void cancel_alreadyCancelled_isIdempotent() throws Exception {
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn("alice@example.com");
        Reservation reservation = mock(Reservation.class);
        when(reservation.getGuest()).thenReturn(guest);
        when(reservation.getStatus()).thenReturn("cancelled");
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("ABC123", ORG))
                .thenReturn(Optional.of(reservation));

        CancellationResultDto result = service.cancel(ORG, "ABC123", "alice@example.com", "x");

        assertThat(result.status()).isEqualTo("already_cancelled");
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), any());
        verify(reservationRepository, never()).save(any());
        verify(stripeService, never()).refundCheckoutSessionPartial(any(), anyLong(), any(), any());
    }
}
