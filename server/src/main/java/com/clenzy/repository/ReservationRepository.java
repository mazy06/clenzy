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
           "AND r.checkOut >= :from AND r.checkIn <= :to ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.id = :propertyId " +
           "ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyId(@Param("propertyId") Long propertyId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.owner.id = :ownerId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerIdAndDateRange(
            @Param("ownerId") Long ownerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.property.owner.keycloakId = :keycloakId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerKeycloakIdAndDateRange(
            @Param("keycloakId") String keycloakId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property " +
           "WHERE r.checkOut >= :from AND r.checkIn <= :to ORDER BY r.checkIn ASC")
    List<Reservation> findAllByDateRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    Optional<Reservation> findByExternalUidAndPropertyId(String externalUid, Long propertyId);

    boolean existsByExternalUidAndPropertyId(String externalUid, Long propertyId);

    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.property.id = :propertyId")
    long countByPropertyId(@Param("propertyId") Long propertyId);
}
