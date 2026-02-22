package com.clenzy.repository;

import com.clenzy.model.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.id IN :propertyIds " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.id = :propertyId " +
           "AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.owner.id = :ownerId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerIdAndDateRange(
            @Param("ownerId") Long ownerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.owner.keycloakId = :keycloakId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerKeycloakIdAndDateRange(
            @Param("keycloakId") String keycloakId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property " +
           "WHERE r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findAllByDateRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

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
}
