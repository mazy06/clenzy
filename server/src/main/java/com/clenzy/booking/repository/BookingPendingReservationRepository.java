package com.clenzy.booking.repository;

import com.clenzy.model.Reservation;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.util.List;

/**
 * Acces dedie du booking engine aux reservations 'pending' non payees (holds).
 *
 * <p>Elargit le perimetre de l'ancien
 * {@code ReservationRepository.findExpiredPendingReservations} (limite a
 * paymentStatus=PENDING) aux paiements FAILED : un paiement Stripe refuse
 * laissait sinon le hold bloquer le calendrier indefiniment, le cleanup ne
 * le ramassant jamais (reliquat revue A3 — liberation des holds).</p>
 *
 * <p>L'expiration n'est plus filtree par une duree fixe en SQL : la duree du hold
 * est configurable PAR ORGANISATION (booking engine), donc le scheduler ramene
 * tous les holds courants puis calcule l'expiration par org.</p>
 */
public interface BookingPendingReservationRepository extends Repository<Reservation, Long> {

    /**
     * Tous les holds 'pending' non payes (PENDING ou FAILED), property + guest charges.
     *
     * <p>LEFT JOIN FETCH r.guest : le cleanup s'execute dans une transaction dediee APRES ce fetch
     * (entite detachee) et lit guest.getEmail()/getFullName() (capture du panier abandonne). Sans
     * fetch, le proxy lazy du guest n'a plus de session → LazyInitializationException, l'annulation
     * echoue et le hold PENDING bloque le calendrier. LEFT car une resa peut ne pas avoir de guest.</p>
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest "
         + "WHERE r.status = 'pending' "
         + "AND r.paymentStatus IN (com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.FAILED)")
    List<Reservation> findUnpaidHolds();

    /** Persistance de l'annulation (signature CRUD standard de Spring Data). */
    Reservation save(Reservation reservation);
}
