package com.clenzy.service;

import com.clenzy.dto.AnomalyDto;
import com.clenzy.model.AnomalySeverity;
import com.clenzy.model.AnomalyType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Moteur de détection d'anomalies (Phase 4 différenciation). Filet de sécurité de surveillance :
 * au-delà de la prévention temps réel (CalendarEngine), il scanne les données pour repérer les
 * incohérences résiduelles. Premier contrôle : le <b>double-booking</b> (sur-réservation), la
 * faute cardinale d'un PMS.
 *
 * <p>La détection est une <b>fonction pure</b> ({@link #detectDoubleBookings}) — entièrement
 * testable sans base. L'orchestration s'appuie sur une requête repository <b>org-scopée</b>
 * ({@link ReservationRepository#findByPropertyId}) : un {@code propertyId} d'une autre org renvoie
 * une liste vide (pas de fuite, défense en profondeur — cf. HP-01).</p>
 */
@Service
public class AnomalyDetectionService {

    private static final String STATUS_CONFIRMED = "CONFIRMED";
    private static final String ENTITY_RESERVATION = "reservation";

    private final ReservationRepository reservationRepository;

    public AnomalyDetectionService(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /**
     * Détecte les anomalies d'un bien (org-scopé).
     */
    @Transactional(readOnly = true)
    public List<AnomalyDto> detectForProperty(Long orgId, Long propertyId) {
        return detectDoubleBookings(reservationRepository.findByPropertyId(propertyId, orgId));
    }

    /**
     * Détecte les chevauchements entre réservations <b>confirmées</b> (fonction pure). Deux
     * réservations se chevauchent si {@code a.checkIn < b.checkOut && b.checkIn < a.checkOut}
     * (intervalles semi-ouverts [checkIn, checkOut), le jour de départ étant libre).
     */
    List<AnomalyDto> detectDoubleBookings(List<Reservation> reservations) {
        List<Reservation> confirmed = reservations.stream()
            .filter(r -> STATUS_CONFIRMED.equalsIgnoreCase(r.getStatus()))
            .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
            .toList();

        List<AnomalyDto> anomalies = new ArrayList<>();
        for (int i = 0; i < confirmed.size(); i++) {
            for (int j = i + 1; j < confirmed.size(); j++) {
                Reservation a = confirmed.get(i);
                Reservation b = confirmed.get(j);
                if (overlaps(a.getCheckIn(), a.getCheckOut(), b.getCheckIn(), b.getCheckOut())) {
                    anomalies.add(new AnomalyDto(
                        AnomalyType.DOUBLE_BOOKING,
                        AnomalySeverity.HIGH,
                        ENTITY_RESERVATION,
                        a.getId(),
                        "Chevauchement avec la réservation " + b.getId()
                            + " (" + a.getCheckIn() + "→" + a.getCheckOut()
                            + " vs " + b.getCheckIn() + "→" + b.getCheckOut() + ")"));
                }
            }
        }
        return anomalies;
    }

    private static boolean overlaps(LocalDate aIn, LocalDate aOut, LocalDate bIn, LocalDate bOut) {
        return aIn.isBefore(bOut) && bIn.isBefore(aOut);
    }
}
