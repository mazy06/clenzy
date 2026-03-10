package com.clenzy.repository;

import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.id IN :propertyIds " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.id = :propertyId " +
           "AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.owner.id = :ownerId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerIdAndDateRange(
            @Param("ownerId") Long ownerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.owner.keycloakId = :keycloakId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerKeycloakIdAndDateRange(
            @Param("keycloakId") String keycloakId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findAllByDateRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest LEFT JOIN FETCH r.intervention WHERE r.id = :id")
    Optional<Reservation> findByIdFetchAll(@Param("id") Long id);

    Optional<Reservation> findByExternalUidAndPropertyId(String externalUid, Long propertyId);

    boolean existsByExternalUidAndPropertyId(String externalUid, Long propertyId);

    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.property.id = :propertyId AND r.organizationId = :orgId")
    long countByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Reservations confirmees avec check-in dans la plage donnee.
     * Utilise par GuestMessagingScheduler pour l'envoi automatique des instructions.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkIn BETWEEN :from AND :to " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    List<Reservation> findConfirmedByCheckInRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("orgId") Long orgId);

    /**
     * Reservation active (en cours) pour une propriete a une date donnee.
     * Utilise par NoiseAlertNotificationService pour envoyer un message au voyageur.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.property.id = :propertyId " +
           "AND r.checkIn <= :date AND r.checkOut >= :date " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    Optional<Reservation> findActiveByPropertyIdAndDate(
        @Param("propertyId") Long propertyId,
        @Param("date") LocalDate date,
        @Param("orgId") Long orgId);

    /**
     * Reservations confirmees avec check-out dans la plage donnee.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkOut BETWEEN :from AND :to " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    List<Reservation> findConfirmedByCheckOutRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("orgId") Long orgId);

    /**
     * Reservations liees a des interventions (via intervention_id FK).
     * Utilise par le planning pour rattacher visuellement les interventions menage au checkout.
     */
    /**
     * Reservations annulees non masquees qui chevauchent une plage de dates sur une propriete.
     * Utilise par ICalImportService pour auto-masquer les annulees lors d'un nouvel import.
     */
    @Query("SELECT r FROM Reservation r WHERE r.property.id = :propertyId " +
           "AND r.status = 'cancelled' AND r.hiddenFromPlanning = false " +
           "AND r.checkOut > :checkIn AND r.checkIn < :checkOut " +
           "AND r.organizationId = :orgId")
    List<Reservation> findCancelledOverlapping(
            @Param("propertyId") Long propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r WHERE r.intervention.id IN :interventionIds AND r.organizationId = :orgId")
    List<Reservation> findByInterventionIdIn(
        @Param("interventionIds") List<Long> interventionIds,
        @Param("orgId") Long orgId);

    /**
     * Compte les reservations dont le guestName commence par un prefix donne, sur une propriete.
     * Utilise par ICalImportService pour incrementer les noms generiques (Reserved #1, #2...).
     */
    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.guestName LIKE CONCAT(:prefix, '%') " +
           "AND r.property.id = :propertyId AND r.organizationId = :orgId")
    long countByGuestNameStartingWithAndPropertyId(
            @Param("prefix") String prefix,
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    // ─── Payment queries ────────────────────────────────────────────────────────

    /**
     * Trouve une reservation par son stripeSessionId (sans orgId — utilise par le webhook Stripe).
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.stripeSessionId = :sessionId")
    Optional<Reservation> findByStripeSessionId(@Param("sessionId") String sessionId);

    /**
     * Historique des paiements de reservations (avec montant > 0).
     * Filtre optionnel par paymentStatus. Trie par createdAt DESC.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.totalPrice IS NOT NULL AND r.totalPrice > 0 " +
           "AND (:status IS NULL OR r.paymentStatus = :status) " +
           "AND r.organizationId = :orgId ORDER BY r.createdAt DESC")
    Page<Reservation> findPaymentHistory(
            @Param("status") PaymentStatus status,
            Pageable pageable,
            @Param("orgId") Long orgId);

    /**
     * Compte les reservations ayant un paiement (totalPrice > 0) pour le summary.
     */
    @Query("SELECT r FROM Reservation r " +
           "WHERE r.totalPrice IS NOT NULL AND r.totalPrice > 0 " +
           "AND r.organizationId = :orgId")
    List<Reservation> findAllWithPayment(@Param("orgId") Long orgId);
}
