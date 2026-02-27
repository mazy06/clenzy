package com.clenzy.repository;

import com.clenzy.model.LengthOfStayDiscount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LengthOfStayDiscountRepository extends JpaRepository<LengthOfStayDiscount, Long> {

    /**
     * Toutes les remises LOS pour une propriete (actives et inactives).
     */
    @Query("SELECT d FROM LengthOfStayDiscount d WHERE " +
           "(d.property.id = :propertyId OR d.property IS NULL) " +
           "AND d.organizationId = :orgId ORDER BY d.minNights ASC")
    List<LengthOfStayDiscount> findByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Remises LOS applicables pour un nombre de nuits donne.
     * Filtre : actif, dans la plage min/max nuits, dans la plage de dates.
     */
    @Query("SELECT d FROM LengthOfStayDiscount d WHERE " +
           "(d.property.id = :propertyId OR d.property IS NULL) " +
           "AND d.isActive = true " +
           "AND d.minNights <= :nights " +
           "AND (d.maxNights IS NULL OR d.maxNights >= :nights) " +
           "AND (d.startDate IS NULL OR d.startDate <= CURRENT_DATE) " +
           "AND (d.endDate IS NULL OR d.endDate >= CURRENT_DATE) " +
           "AND d.organizationId = :orgId " +
           "ORDER BY d.minNights DESC")
    List<LengthOfStayDiscount> findApplicable(
            @Param("propertyId") Long propertyId,
            @Param("nights") int nights,
            @Param("orgId") Long orgId);
}
