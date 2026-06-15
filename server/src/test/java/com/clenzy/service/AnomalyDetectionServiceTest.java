package com.clenzy.service;

import com.clenzy.dto.AnomalyDto;
import com.clenzy.model.AnomalyType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Moteur de détection d'anomalies (Phase 4) : double-booking (logique pure) + délégation org-scopée.
 */
class AnomalyDetectionServiceTest {

    private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
    private final AnomalyDetectionService service = new AnomalyDetectionService(reservationRepository);

    private Reservation res(Long id, String status, String checkIn, String checkOut) {
        Reservation r = new Reservation();
        r.setId(id);
        r.setStatus(status);
        r.setCheckIn(LocalDate.parse(checkIn));
        r.setCheckOut(LocalDate.parse(checkOut));
        return r;
    }

    @Test
    void detectsOverlappingConfirmedReservations() {
        List<Reservation> reservations = List.of(
            res(1L, "CONFIRMED", "2026-07-01", "2026-07-05"),
            res(2L, "CONFIRMED", "2026-07-04", "2026-07-08")); // chevauche le 04

        List<AnomalyDto> anomalies = service.detectDoubleBookings(reservations);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).type()).isEqualTo(AnomalyType.DOUBLE_BOOKING);
        assertThat(anomalies.get(0).entityId()).isEqualTo(1L);
        assertThat(anomalies.get(0).description()).contains("2");
    }

    @Test
    void ignoresNonConfirmedReservations() {
        List<Reservation> reservations = List.of(
            res(1L, "CONFIRMED", "2026-07-01", "2026-07-05"),
            res(2L, "CANCELLED", "2026-07-02", "2026-07-06"),
            res(3L, "PENDING", "2026-07-03", "2026-07-07"));

        assertThat(service.detectDoubleBookings(reservations)).isEmpty();
    }

    @Test
    void backToBackStaysIsNotAnOverlap() {
        // depart le 05 = arrivee le 05 : intervalles semi-ouverts, pas de chevauchement
        List<Reservation> reservations = List.of(
            res(1L, "CONFIRMED", "2026-07-01", "2026-07-05"),
            res(2L, "CONFIRMED", "2026-07-05", "2026-07-09"));

        assertThat(service.detectDoubleBookings(reservations)).isEmpty();
    }

    @Test
    void distinctDatesYieldNoAnomaly() {
        List<Reservation> reservations = List.of(
            res(1L, "CONFIRMED", "2026-07-01", "2026-07-03"),
            res(2L, "CONFIRMED", "2026-07-10", "2026-07-12"));

        assertThat(service.detectDoubleBookings(reservations)).isEmpty();
    }

    @Test
    void detectForPropertyUsesOrgScopedQuery() {
        when(reservationRepository.findByPropertyId(7L, 1L)).thenReturn(List.of(
            res(1L, "CONFIRMED", "2026-07-01", "2026-07-05"),
            res(2L, "CONFIRMED", "2026-07-03", "2026-07-06")));

        List<AnomalyDto> anomalies = service.detectForProperty(1L, 7L);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).type()).isEqualTo(AnomalyType.DOUBLE_BOOKING);
    }
}
