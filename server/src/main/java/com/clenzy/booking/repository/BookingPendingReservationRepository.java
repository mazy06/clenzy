package com.clenzy.booking.repository;

import com.clenzy.model.Reservation;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Acces dedie du booking engine aux reservations pending expirees.
 *
 * <p>Elargit le perimetre de l'ancien
 * {@code ReservationRepository.findExpiredPendingReservations} (limite a
 * paymentStatus=PENDING) aux paiements FAILED : un paiement Stripe refuse
 * laissait sinon le hold bloquer le calendrier indefiniment, le cleanup ne
 * le ramassant jamais (reliquat revue A3 — liberation des holds).</p>
 */
public interface BookingPendingReservationRepository extends Repository<Reservation, Long> {

    /**
     * Reservations 'pending' non payees (PENDING ou FAILED) creees avant
     * {@code cutoff}. Le scheduler de cleanup expire leur session Stripe puis
     * libere les dates.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property "
         + "WHERE r.status = 'pending' "
         + "AND r.paymentStatus IN (com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.FAILED) "
         + "AND r.createdAt < :cutoff")
    List<Reservation> findExpiredUnpaidReservations(@Param("cutoff") LocalDateTime cutoff);

    /** Persistance de l'annulation (signature CRUD standard de Spring Data). */
    Reservation save(Reservation reservation);
}
