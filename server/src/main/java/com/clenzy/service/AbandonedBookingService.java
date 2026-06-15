package com.clenzy.service;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.model.AbandonedBookingStatus;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AbandonedBookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;

/**
 * Récupération de panier abandonné (CLZ Domaine 2) : enregistre un snapshot d'une réservation
 * PENDING expirée (avec email voyageur) pour relance ultérieure. Idempotent par (org, reservation).
 */
@Service
public class AbandonedBookingService {

    private static final Logger log = LoggerFactory.getLogger(AbandonedBookingService.class);

    private final AbandonedBookingRepository repository;
    private final Clock clock;

    public AbandonedBookingService(AbandonedBookingRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Enregistre un panier abandonné depuis une réservation expirée, si elle a un email voyageur
     * et n'est pas déjà enregistrée. Appelé dans la transaction de nettoyage (insert DB, pas d'appel externe).
     */
    public void recordIfAbsent(Reservation reservation) {
        if (reservation == null || reservation.getId() == null) {
            return;
        }
        Guest guest = reservation.getGuest();
        String email = guest != null ? guest.getEmail() : null;
        if (email == null || email.isBlank()) {
            return; // pas d'email -> pas de relance possible
        }
        Long orgId = reservation.getOrganizationId();
        if (repository.existsByOrganizationIdAndReservationId(orgId, reservation.getId())) {
            return; // idempotent
        }

        AbandonedBooking ab = new AbandonedBooking();
        ab.setOrganizationId(orgId);
        ab.setReservationId(reservation.getId());
        ab.setGuestEmail(email.trim());
        ab.setGuestName(reservation.getGuestName() != null ? reservation.getGuestName()
            : (guest.getFullName() != null ? guest.getFullName() : null));
        ab.setCheckIn(reservation.getCheckIn());
        ab.setCheckOut(reservation.getCheckOut());
        ab.setGuests(reservation.getGuestCount());
        ab.setTotal(reservation.getTotalPrice());
        ab.setCurrency(reservation.getCurrency());
        if (reservation.getProperty() != null) {
            ab.setPropertyId(reservation.getProperty().getId());
            ab.setPropertyName(reservation.getProperty().getName());
        }
        ab.setStatus(AbandonedBookingStatus.PENDING);
        ab.setCreatedAt(clock.instant());
        repository.save(ab);
        log.info("Panier abandonne enregistre : reservation {} (org {})", reservation.getId(), orgId);
    }

    /** Marque un panier comme relancé (email envoyé). */
    public void markRecoverySent(AbandonedBooking abandoned) {
        abandoned.setStatus(AbandonedBookingStatus.RECOVERY_SENT);
        abandoned.setRecoverySentAt(clock.instant());
        repository.save(abandoned);
    }

    /**
     * Enregistre l'envoi d'une relance multi-étapes (2.12) : incrémente le compteur. À la dernière
     * étape ({@code finalStep}), le panier passe en RECOVERY_SENT (terminal) ; sinon il reste PENDING
     * pour la relance suivante. Garde {@code recoverySentAt} = horodatage de la DERNIÈRE relance.
     */
    public void recordReminderSent(AbandonedBooking abandoned, boolean finalStep) {
        abandoned.setReminderCount(abandoned.getReminderCount() + 1);
        abandoned.setRecoverySentAt(clock.instant());
        if (finalStep) {
            abandoned.setStatus(AbandonedBookingStatus.RECOVERY_SENT);
        }
        repository.save(abandoned);
    }
}
