package com.clenzy.repository;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.PropertyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public interface CalendarDayRepository extends JpaRepository<CalendarDay, Long> {
    /** One indexed conflict check for the whole staged import, instead of one round-trip per row. */
    @Query(value = "SELECT r.row_key FROM jsonb_to_recordset(CAST(:ranges AS jsonb)) "
        + "AS r(row_key text, property_id bigint, date_from date, date_to date, status text) "
        + "WHERE r.status = 'confirmed' AND EXISTS (SELECT 1 FROM calendar_days cd "
        + "WHERE cd.organization_id = :org AND cd.property_id = r.property_id "
        + "AND cd.date >= r.date_from AND cd.date < r.date_to AND cd.status <> 'AVAILABLE')", nativeQuery = true)
    List<String> findPmsImportConflicts(@Param("ranges") String ranges, @Param("org") Long org);

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
     * Batch : recupere les jours de PLUSIEURS proprietes dans une plage de dates.
     * Evite le N+1 quand on charge le calendrier pour toutes les proprietes.
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.property.id IN :propertyIds " +
           "AND cd.date >= :from AND cd.date <= :to AND cd.organizationId = :orgId " +
           "ORDER BY cd.property.id, cd.date")
    List<CalendarDay> findByPropertiesAndDateRange(
            @Param("propertyIds") Set<Long> propertyIds,
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

    /**
     * Dates BOOKED d'une plage (yield v1 F8a : occupation de la fenetre = taille
     * du resultat / jours de la fenetre, et les nuits reservees ne sont jamais
     * re-tarifees). Convention Baitly : absence de ligne = disponible.
     */
    @Query("SELECT cd.date FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date < :to AND cd.status = com.clenzy.model.CalendarDayStatus.BOOKED " +
           "AND cd.organizationId = :orgId")
    List<LocalDate> findBookedDatesInRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Dates INDISPONIBLES (≠ AVAILABLE : BOOKED <b>ou</b> BLOCKED) d'une plage [from, to) pour une
     * propriété. Couvre à la fois les nuits réservées/synchronisées (BOOKED) et les blocages manuels
     * ou externes (BLOCKED) — une résa prise hors OTA/Baitly ne doit jamais être re-tarifée.
     */
    @Query("SELECT cd.date FROM CalendarDay cd WHERE cd.property.id = :propertyId " +
           "AND cd.date >= :from AND cd.date < :to " +
           "AND cd.status <> com.clenzy.model.CalendarDayStatus.AVAILABLE " +
           "AND cd.organizationId = :orgId")
    List<LocalDate> findUnavailableDatesInRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Jours INDISPONIBLES (≠ AVAILABLE) par propriété sur [from, to) (batch, urgence honnête 2.9).
     * Convention Baitly : absence de ligne = disponible → dispo = (jours fenêtre) − (count retourné).
     */
    @Query("SELECT cd.property.id, COUNT(cd) FROM CalendarDay cd WHERE cd.property.id IN :propertyIds " +
           "AND cd.date >= :from AND cd.date < :to " +
           "AND cd.status <> com.clenzy.model.CalendarDayStatus.AVAILABLE GROUP BY cd.property.id")
    List<Object[]> countUnavailableByPropertyIds(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    /**
     * Recupere les jours BLOCKED ou MAINTENANCE pour plusieurs proprietes dans une plage [from, to).
     * Utilise par le planning pour afficher les periodes bloquees.
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.property.id IN :propertyIds " +
           "AND cd.date >= :from AND cd.date < :to " +
           "AND cd.status IN (com.clenzy.model.CalendarDayStatus.BLOCKED, com.clenzy.model.CalendarDayStatus.MAINTENANCE) " +
           "AND cd.organizationId = :orgId ORDER BY cd.property.id, cd.date")
    List<CalendarDay> findBlockedOrMaintenanceForProperties(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Nuits fermées à la vente (BLOCKED / MAINTENANCE) sur [from, toExclusive) des logements
     * du dashboard overview — même périmètre que {@code PropertyRepository.countForDashboardByStatus}
     * (org stricte, propriétaire optionnel pour un HOST, statut du logement), en UNE requête
     * pour tout le portefeuille. Lignes {@code [Long propertyId, LocalDate date]}.
     * Le CAST type {@code :ownerKc} pour PostgreSQL même quand le pilote envoie les chaînes
     * non typées ({@code stringtype=unspecified}, socle des tests d'intégration).
     */
    @Query("SELECT cd.property.id, cd.date FROM CalendarDay cd WHERE cd.organizationId = :orgId "
        + "AND (CAST(:ownerKc AS string) IS NULL OR cd.property.owner.keycloakId = :ownerKc) "
        + "AND cd.property.status = :propertyStatus "
        + "AND cd.date >= :from AND cd.date < :toExclusive "
        + "AND cd.status IN (com.clenzy.model.CalendarDayStatus.BLOCKED, com.clenzy.model.CalendarDayStatus.MAINTENANCE)")
    List<Object[]> findClosedNightsForDashboard(
            @Param("from") LocalDate from,
            @Param("toExclusive") LocalDate toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("propertyStatus") PropertyStatus propertyStatus);

    // ── Admin queries (cross-org, SUPER_ADMIN only) ─────────────────────────

    /**
     * Jours BOOKED sans reservation liee (donnee incoherente — diagnostic).
     */
    @Query("SELECT cd FROM CalendarDay cd WHERE cd.status = com.clenzy.model.CalendarDayStatus.BOOKED AND cd.reservation IS NULL")
    List<CalendarDay> findOrphanedBookedDays();
}
