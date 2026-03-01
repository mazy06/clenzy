package com.clenzy.repository;

import com.clenzy.model.OccupancyPricing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OccupancyPricingRepository extends JpaRepository<OccupancyPricing, Long> {

    /**
     * Configuration de tarification par occupation pour une propriete.
     * Une seule configuration active par propriete.
     */
    @Query("SELECT op FROM OccupancyPricing op WHERE op.property.id = :propertyId " +
           "AND op.isActive = true AND op.organizationId = :orgId")
    Optional<OccupancyPricing> findByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);
}
