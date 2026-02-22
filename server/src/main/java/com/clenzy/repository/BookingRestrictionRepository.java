package com.clenzy.repository;

import com.clenzy.model.BookingRestriction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BookingRestrictionRepository extends JpaRepository<BookingRestriction, Long> {

    /**
     * Restrictions applicables : celles dont la plage [start_date, end_date]
     * chevauche la plage de reservation [checkIn, checkOut).
     * Triees par priorite DESC pour que la plus prioritaire soit en premier.
     */
    @Query("SELECT br FROM BookingRestriction br WHERE br.property.id = :propertyId " +
           "AND br.startDate <= :checkOut AND br.endDate >= :checkIn " +
           "AND br.organizationId = :orgId " +
           "ORDER BY br.priority DESC")
    List<BookingRestriction> findApplicable(
            @Param("propertyId") Long propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("orgId") Long orgId);

    /**
     * Toutes les restrictions d'une propriete.
     */
    @Query("SELECT br FROM BookingRestriction br WHERE br.property.id = :propertyId " +
           "AND br.organizationId = :orgId ORDER BY br.priority DESC")
    List<BookingRestriction> findByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);
}
