package com.clenzy.repository;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CalendarDayRepository extends JpaRepository<CalendarDay, Long> {

    /**
     * Acquiert un advisory lock transactionnel sur une propriete.
     * Le lock est automatiquement libere a la fin de la transaction.
     * Serialise les ecritures calendrier par propriete sans bloquer les autres proprietes.
     *
     * @return true si le lock est acquis, false si deja pris par une autre transaction
     */
    @Query(value = "SELECT pg_try_advisory_xact_lock(:propertyId)", nativeQuery = true)
    boolean acquirePropertyLock(@Param("propertyId") Long propertyId);

    /**
     * Recupere les jours d'une propriete dans une plage de dates (bornes incluses).
     * Utilise pour lire l'etat actuel du calendrier avant mutation.
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date <= :to AND cd.organizationId = :orgId " +
           "ORDER BY cd.date")
    List<CalendarDay> findByPropertyAndDateRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Compte les jours non-AVAILABLE dans une plage [from, to).
     * to est EXCLUSIF car en location courte duree, le jour de checkout
     * est disponible pour un nouveau check-in.
     *
     * Utilise pour la verification anti-double-booking.
     */
    @Query("SELECT COUNT(cd) FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date < :to AND cd.status <> com.clenzy.model.CalendarDayStatus.AVAILABLE " +
           "AND cd.organizationId = :orgId")
    long countConflicts(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Libere les jours d'une reservation (annulation).
     * Remet les jours en AVAILABLE et supprime le lien reservation.
     * Utilise native SQL car JPQL ne supporte pas SET null sur une FK dans un UPDATE.
     *
     * @return nombre de lignes mises a jour
     */
    @Modifying
    @Query(value = "UPDATE calendar_days SET status = 'AVAILABLE', reservation_id = NULL, source = 'MANUAL', " +
                   "updated_at = now() WHERE reservation_id = :reservationId AND organization_id = :orgId",
           nativeQuery = true)
    int releaseByReservation(
            @Param("reservationId") Long reservationId,
            @Param("orgId") Long orgId);

    /**
     * Recupere les jours bloques dans une plage [from, to) pour une propriete.
     * Utilise par unblock() pour remettre les jours en AVAILABLE.
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date < :to AND cd.status = com.clenzy.model.CalendarDayStatus.BLOCKED " +
           "AND cd.organizationId = :orgId")
    List<CalendarDay> findBlockedInRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Met a jour le reservation_id sur les CalendarDays d'une plage [from, to).
     * Appele apres la sauvegarde de la reservation pour lier les jours.
     * Utilise native SQL car JPQL ne supporte pas SET sur une FK directement.
     */
    @Modifying
    @Query(value = "UPDATE calendar_days SET reservation_id = :reservationId, updated_at = now() " +
                   "WHERE property_id = :propertyId AND date >= :from AND date < :to " +
                   "AND status = 'BOOKED' AND organization_id = :orgId",
           nativeQuery = true)
    int linkReservation(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("reservationId") Long reservationId,
            @Param("orgId") Long orgId);

    /**
     * Compte les jours BOOKED dans une plage (pour verifier avant de bloquer).
     */
    @Query("SELECT COUNT(cd) FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date < :to AND cd.status = com.clenzy.model.CalendarDayStatus.BOOKED " +
           "AND cd.organizationId = :orgId")
    long countBookedInRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    // ── Admin queries (cross-org, SUPER_ADMIN only) ─────────────────────────

    /**
     * Jours BOOKED sans reservation liee (donnee incoherente — diagnostic).
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.status = com.clenzy.model.CalendarDayStatus.BOOKED AND cd.reservation IS NULL")
    List<CalendarDay> findOrphanedBookedDays();
}
