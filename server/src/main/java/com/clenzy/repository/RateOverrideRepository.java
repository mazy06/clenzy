package com.clenzy.repository;

import com.clenzy.model.RateOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RateOverrideRepository extends JpaRepository<RateOverride, Long> {

    /**
     * Override pour une propriete et une date specifique.
     * Filtre par orgId pour l'isolation multi-tenant.
     */
    @Query("SELECT ro FROM RateOverride ro WHERE ro.property.id = :propertyId " +
           "AND ro.date = :date AND ro.organizationId = :orgId")
    Optional<RateOverride> findByPropertyIdAndDate(
            @Param("propertyId") Long propertyId,
            @Param("date") LocalDate date,
            @Param("orgId") Long orgId);

    /**
     * Tous les overrides dans une plage de dates pour une propriete.
     * Charge en batch pour la resolution de prix sur une plage.
     * Filtre par orgId pour l'isolation multi-tenant.
     */
    @Query("SELECT ro FROM RateOverride ro WHERE ro.property.id = :propertyId " +
           "AND ro.date >= :from AND ro.date < :to AND ro.organizationId = :orgId " +
           "ORDER BY ro.date")
    List<RateOverride> findByPropertyIdAndDateRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);
}
