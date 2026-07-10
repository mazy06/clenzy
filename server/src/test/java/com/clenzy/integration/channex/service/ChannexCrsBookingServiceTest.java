package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C2 — Booking CRS : push des resas directes vers Channex (ota Offline).
 * Le point le plus sensible : la repartition du prix par nuit (argent —
 * la somme des nuits DOIT egaler le total exact, jamais de centimes perdus).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexCrsBookingService")
class ChannexCrsBookingServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ReservationRepository reservationRepository;

    private ChannexCrsBookingService service;
    private Reservation reservation;
    private ChannexPropertyMapping mapping;

    @BeforeEach
    void setUp() {
        service = new ChannexCrsBookingService(channexClient, mappingRepository, reservationRepository);

        Property property = new Property();
        property.setId(100L);
        property.setOrganizationId(42L);

        Guest guest = new Guest();
        guest.setFirstName("Jane");
        guest.setLastName("Doe");
        guest.setEmail("jane@example.com");

        reservation = new Reservation();
        reservation.setId(555L);
        reservation.setOrganizationId(42L);
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setCheckIn(LocalDate.of(2026, 9, 1));
        reservation.setCheckOut(LocalDate.of(2026, 9, 4)); // 3 nuits
        reservation.setTotalPrice(new BigDecimal("100.00"));
        reservation.setCurrency("EUR");
        reservation.setConfirmationCode("BAI-123");
        reservation.setGuestCount(2);
        reservation.setAdultsCount(2);
        reservation.setChildrenCount(0);

        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("chx-1");
        mapping.setChannexRoomTypeId("rt-1");
        mapping.setChannexDefaultRatePlanId("rp-1");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturePayload() {
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(channexClient).createCrsBooking(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("100.00 EUR sur 3 nuits -> 33.33 + 33.33 + 33.34 (somme EXACTE, ajustement derniere nuit)")
    void nightPricesSumToExactTotal() {
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.createCrsBooking(any())).thenReturn("chx-book-1");

        var result = service.pushReservation(555L, 42L);

        assertThat(result.status()).isEqualTo("pushed");
        Map<String, Object> payload = capturePayload();
        @SuppressWarnings("unchecked")
        Map<String, Object> days = (Map<String, Object>)
            ((Map<String, Object>) ((java.util.List<Object>) payload.get("rooms")).get(0)).get("days");

        assertThat(days).containsEntry("2026-09-01", "33.33")
                        .containsEntry("2026-09-02", "33.33")
                        .containsEntry("2026-09-03", "33.34");
        BigDecimal sum = days.values().stream()
            .map(v -> new BigDecimal(v.toString()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sum).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("payload CRS : ota Offline + mapping room/rate + customer + occupancy")
    void payloadCarriesCrsContract() {
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.createCrsBooking(any())).thenReturn("chx-book-1");

        service.pushReservation(555L, 42L);

        Map<String, Object> payload = capturePayload();
        assertThat(payload)
            .containsEntry("property_id", "chx-1")
            .containsEntry("ota_name", "Offline")
            .containsEntry("ota_reservation_code", "BAI-123")
            .containsEntry("arrival_date", "2026-09-01")
            .containsEntry("departure_date", "2026-09-04")
            .containsEntry("currency", "EUR");
        @SuppressWarnings("unchecked")
        Map<String, Object> room = (Map<String, Object>)
            ((java.util.List<Object>) payload.get("rooms")).get(0);
        assertThat(room).containsEntry("room_type_id", "rt-1")
                        .containsEntry("rate_plan_id", "rp-1");
    }

    @Test
    @DisplayName("id Channex retourne -> persiste sur la reservation")
    void persistsChannexBookingId() {
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.createCrsBooking(any())).thenReturn("chx-book-9");

        service.pushReservation(555L, 42L);

        ArgumentCaptor<Reservation> saved = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository).save(saved.capture());
        assertThat(saved.getValue().getChannexCrsBookingId()).isEqualTo("chx-book-9");
    }

    @Test
    @DisplayName("resa deja poussee -> already_pushed, pas de nouveau POST (idempotence)")
    void alreadyPushedSkips() {
        reservation.setChannexCrsBookingId("chx-book-1");
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));

        var result = service.pushReservation(555L, 42L);

        assertThat(result.status()).isEqualTo("already_pushed");
        verify(channexClient, never()).createCrsBooking(any());
    }

    @Test
    @DisplayName("resa VENUE de Channex -> jamais re-poussee (boucle)")
    void otaBookingNeverPushed() {
        reservation.setExternalUid("channex:booking-abc");
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));

        var result = service.pushReservation(555L, 42L);

        assertThat(result.status()).isEqualTo("skipped_ota_booking");
        verify(channexClient, never()).createCrsBooking(any());
    }

    @Test
    @DisplayName("resa d'une autre org -> AccessDeniedException (audit n°3)")
    void crossOrgDenied() {
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> service.pushReservation(555L, 999L))
            .isInstanceOf(AccessDeniedException.class);
        verify(channexClient, never()).createCrsBooking(any());
    }

    @Test
    @DisplayName("annulation d'une resa poussee -> PUT status=cancelled")
    void cancelPushedReservation() {
        reservation.setChannexCrsBookingId("chx-book-1");
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));

        var result = service.cancelPushedReservation(555L, 42L);

        assertThat(result.status()).isEqualTo("cancelled");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(channexClient).updateCrsBooking(anyString(), captor.capture());
        assertThat(captor.getValue()).containsEntry("status", "cancelled");
    }

    @Test
    @DisplayName("annulation d'une resa jamais poussee -> not_pushed, aucun appel")
    void cancelNotPushedNoop() {
        when(reservationRepository.findById(555L)).thenReturn(Optional.of(reservation));

        var result = service.cancelPushedReservation(555L, 42L);

        assertThat(result.status()).isEqualTo("not_pushed");
        verify(channexClient, never()).updateCrsBooking(anyString(), any());
    }
}
