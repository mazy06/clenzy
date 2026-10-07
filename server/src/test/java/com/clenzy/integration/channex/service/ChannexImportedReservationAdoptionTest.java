package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.GuestService;
import com.clenzy.service.NotificationService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** A stay imported from the previous PMS is adopted by the channel feed: no duplicate, guest contact completed. */
@ExtendWith(MockitoExtension.class)
class ChannexImportedReservationAdoptionTest {
    @Mock ChannexPropertyMappingRepository mappings;
    @Mock ReservationRepository reservations;
    @Mock PropertyRepository properties;
    @Mock GuestService guests;
    @Mock CalendarEngine calendar;
    @Mock NotificationService notifications;
    @Mock CalendarDayRepository days;
    private ChannexBookingService service;
    private Reservation imported;

    @BeforeEach void setUp() {
        service = new ChannexBookingService(mappings, reservations, properties, guests, calendar, notifications,
            new ChannexMetrics(new SimpleMeterRegistry()), days);
        var mapping = new ChannexPropertyMapping();
        mapping.setOrganizationId(42L); mapping.setClenzyPropertyId(100L); mapping.setChannexPropertyId("cx-1");
        when(mappings.findByChannexPropertyIdAnyOrg("cx-1")).thenReturn(Optional.of(mapping));
        var property = new Property(); property.setId(100L); property.setOrganizationId(42L);
        imported = new Reservation();
        imported.setId(5L); imported.setOrganizationId(42L); imported.setProperty(property);
        imported.setCheckIn(LocalDate.of(2026, 11, 2)); imported.setCheckOut(LocalDate.of(2026, 11, 5));
        imported.setConfirmationCode("HMABC"); imported.setExternalUid("baitly-import:abc"); imported.setStatus("confirmed");
        var guest = new Guest(); guest.setId(9L); guest.setFirstName("Salma");
        imported.setGuest(guest);
    }

    private ChannexBookingDto booking(String status) {
        var customer = new ChannexBookingDto.ChannexCustomer("Salma", "Alaoui", "salma@example.com", "+212600000000", "MA", "fr");
        return new ChannexBookingDto("bk-1", null, null, "HMABC", "Airbnb", "cx-1", status,
            LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 5), new BigDecimal("300"), "EUR", null, customer, List.of());
    }

    @Test void newBookingAdoptsImportedStayAndFillsMissingEmail() {
        when(reservations.findByExternalUidAndPropertyId("channex:bk-1", 100L))
            .thenReturn(Optional.empty(), Optional.of(imported));
        when(reservations.findImportedByConfirmationCode(100L, "HMABC")).thenReturn(List.of(imported));
        when(reservations.save(any())).thenAnswer(call -> call.getArgument(0));

        var result = service.handleNewBooking(booking("new"));

        assertThat(result).isSameAs(imported);
        assertThat(imported.getExternalUid()).isEqualTo("channex:bk-1");
        assertThat(imported.getGuest().getEmail()).isEqualTo("salma@example.com");
        verify(properties, never()).findById(any());
        verify(calendar, never()).cancel(any(), any(), any());
    }

    @Test void ambiguousMatchFallsBackToTheNormalFlow() {
        when(reservations.findByExternalUidAndPropertyId("channex:bk-1", 100L)).thenReturn(Optional.empty());
        var other = new Reservation(); other.setOrganizationId(42L);
        when(reservations.findImportedByConfirmationCode(100L, "HMABC")).thenReturn(List.of(imported, other));
        when(properties.findById(100L)).thenReturn(Optional.empty());
        try { service.handleNewBooking(booking("new")); } catch (IllegalStateException expected) { /* property lookup */ }
        assertThat(imported.getExternalUid()).isEqualTo("baitly-import:abc");
    }
}
