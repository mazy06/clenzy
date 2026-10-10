package com.clenzy.service;

import com.clenzy.dto.*;
import com.clenzy.model.Reservation;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyPlanningReservationServiceTest {
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final GuestRepository guests = mock(GuestRepository.class);
    final TenantContext tenant = mock(TenantContext.class);
    final LocalDate from = LocalDate.of(2026, 10, 1), to = from.plusDays(30);
    final ReservationMapper mapper = new ReservationMapper(null, null, new GuestPhotoUrlResolver(null),
            new com.clenzy.service.agent.analytics.ChannelCommissionResolver());
    final BaitlyPlanningReservationService service = new BaitlyPlanningReservationService(
            reservations, guests, mapper, tenant, new SimpleMeterRegistry());

    @Test void readsCoordinatesOnceForRepeatedGuestsAndPreservesReservationsWithoutGuests() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        var stay = new Reservation(); stay.setId(1L);
        when(reservations.findBaitlyPlanningDetails(List.of(2L), from, to, 8L)).thenReturn(List.of(
                new BaitlyPlanningReservationRow(stay, 2L, "Logement", 3L, null),
                new BaitlyPlanningReservationRow(stay, 2L, "Logement", 3L, null),
                new BaitlyPlanningReservationRow(stay, 2L, "Logement", null, null)));
        when(guests.findBaitlyPlanningContacts(List.of(3L), 8L)).thenReturn(List.of(
                new BaitlyPlanningGuestContact(3L, "guest@example.test", "phone", null)));
        var result = service.details(List.of(2L), from, to);
        assertThat(result.reservations()).hasSize(3);
        assertThat(result.reservations().getFirst().guestEmail()).isEqualTo("guest@example.test");
        assertThat(result.reservations().getLast().guestId()).isNull();
        assertThat(result.reservations().getLast().guestEmail()).isNull();
        verify(guests).findBaitlyPlanningContacts(List.of(3L), 8L);
        verifyNoMoreInteractions(guests);
    }

    @Test void doesNotIssueAnEmptyContactQuery() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        var stay = new Reservation(); stay.setId(1L);
        when(reservations.findBaitlyPlanningDetails(List.of(2L), from, to, 8L)).thenReturn(List.of(
                new BaitlyPlanningReservationRow(stay, 2L, "Logement", null, null)));
        assertThat(service.details(List.of(2L), from, to).reservations()).hasSize(1);
        verifyNoInteractions(guests);
    }
}
