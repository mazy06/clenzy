package com.clenzy.booking.service;

import com.clenzy.booking.dto.GuestBookingSummaryDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Re-booking 1-clic (2.11) : liste des séjours directs d'un voyageur, scopée (org, email) ;
 * garde anti-requête inutile et mapping vers DTO.
 */
@ExtendWith(MockitoExtension.class)
class PublicGuestBookingsServiceTest {

    @Mock private ReservationRepository reservationRepository;

    private PublicGuestBookingsService service() {
        return new PublicGuestBookingsService(reservationRepository);
    }

    @Test
    void listBookings_blankEmail_returnsEmptyAndDoesNotQuery() {
        assertThat(service().listBookings(1L, "  ")).isEmpty();
        assertThat(service().listBookings(1L, null)).isEmpty();
        assertThat(service().listBookings(null, "guest@x.fr")).isEmpty();
        verifyNoInteractions(reservationRepository);
    }

    @Test
    void listBookings_normalizesEmailAndMapsToDto() {
        Property property = mock(Property.class);
        when(property.getId()).thenReturn(42L);
        when(property.getName()).thenReturn("Villa Azur");
        Reservation r = mock(Reservation.class);
        when(r.getProperty()).thenReturn(property);
        when(r.getConfirmationCode()).thenReturn("CODE-1");
        when(r.getCheckIn()).thenReturn(LocalDate.of(2026, 1, 10));
        when(r.getCheckOut()).thenReturn(LocalDate.of(2026, 1, 14));
        when(r.getGuestCount()).thenReturn(3);
        when(r.getStatus()).thenReturn("confirmed");
        when(r.getTotalPrice()).thenReturn(BigDecimal.valueOf(820));
        when(r.getCurrency()).thenReturn("EUR");

        when(reservationRepository.findGuestDirectBookings(eq(7L), eq("guest@x.fr"), any(Pageable.class)))
                .thenReturn(List.of(r));

        List<GuestBookingSummaryDto> result = service().listBookings(7L, "  Guest@X.FR ");

        assertThat(result).hasSize(1);
        GuestBookingSummaryDto dto = result.get(0);
        assertThat(dto.code()).isEqualTo("CODE-1");
        assertThat(dto.propertyId()).isEqualTo(42L);
        assertThat(dto.propertyName()).isEqualTo("Villa Azur");
        assertThat(dto.guests()).isEqualTo(3);
        assertThat(dto.total()).isEqualByComparingTo("820");
        assertThat(dto.currency()).isEqualTo("EUR");

        // Email normalisé (trim + lowercase) transmis au repository.
        ArgumentCaptor<String> emailArg = ArgumentCaptor.forClass(String.class);
        verify(reservationRepository).findGuestDirectBookings(eq(7L), emailArg.capture(), any(Pageable.class));
        assertThat(emailArg.getValue()).isEqualTo("guest@x.fr");
    }

    @Test
    void listBookings_nullGuestCount_fallsBackToOne() {
        Property property = mock(Property.class);
        when(property.getId()).thenReturn(1L);
        when(property.getName()).thenReturn("Studio");
        Reservation r = mock(Reservation.class);
        when(r.getProperty()).thenReturn(property);
        when(r.getConfirmationCode()).thenReturn("CODE-2");
        when(r.getCheckIn()).thenReturn(LocalDate.of(2026, 2, 1));
        when(r.getCheckOut()).thenReturn(LocalDate.of(2026, 2, 3));
        when(r.getGuestCount()).thenReturn(null);
        when(r.getStatus()).thenReturn("confirmed");
        when(r.getTotalPrice()).thenReturn(BigDecimal.TEN);
        when(r.getCurrency()).thenReturn("EUR");
        when(reservationRepository.findGuestDirectBookings(eq(1L), eq("g@x.fr"), any(Pageable.class)))
                .thenReturn(List.of(r));

        assertThat(service().listBookings(1L, "g@x.fr").get(0).guests()).isEqualTo(1);
        verify(reservationRepository, never()).findById(any());
    }
}
