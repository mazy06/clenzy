package com.clenzy.booking.service;

import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler qui annule les reservations PENDING non payees apres 30 minutes.
 * Execute toutes les 5 minutes.
 * Libere les dates bloquees dans le calendrier.
 */
@Component
public class PendingReservationCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(PendingReservationCleanupScheduler.class);

    /** Delai d'expiration en minutes. */
    private static final int EXPIRATION_MINUTES = 30;

    private final ReservationRepository reservationRepository;
    private final CalendarEngine calendarEngine;

    public PendingReservationCleanupScheduler(ReservationRepository reservationRepository,
                                               CalendarEngine calendarEngine) {
        this.reservationRepository = reservationRepository;
        this.calendarEngine = calendarEngine;
    }

    @Scheduled(fixedRate = 300_000) // 5 minutes
    @Transactional
    public void cleanupExpiredPendingReservations() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(EXPIRATION_MINUTES);
        List<Reservation> expired = reservationRepository.findExpiredPendingReservations(cutoff);

        if (expired.isEmpty()) {
            return;
        }

        log.info("Nettoyage des reservations PENDING expirees : {} trouvees", expired.size());

        for (Reservation reservation : expired) {
            try {
                // Annuler la reservation
                reservation.setStatus("cancelled");
                reservation.setPaymentStatus(PaymentStatus.CANCELLED);
                reservationRepository.save(reservation);

                // Liberer les dates dans le calendrier
                calendarEngine.cancel(
                    reservation.getId(),
                    reservation.getOrganizationId(),
                    "booking-engine-cleanup"
                );

                log.info("Reservation PENDING expiree annulee : {} (property {}, org {})",
                    reservation.getConfirmationCode(),
                    reservation.getProperty() != null ? reservation.getProperty().getId() : "?",
                    reservation.getOrganizationId());
            } catch (Exception e) {
                log.error("Erreur lors de l'annulation de la reservation {} : {}",
                    reservation.getId(), e.getMessage(), e);
            }
        }
    }
}
