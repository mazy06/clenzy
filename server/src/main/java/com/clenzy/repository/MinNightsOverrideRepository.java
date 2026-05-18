package com.clenzy.repository;

import com.clenzy.model.MinNightsOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MinNightsOverrideRepository extends JpaRepository<MinNightsOverride, Long> {

    /**
     * Override pour une propriete et une date specifique.
     * Filtre par orgId pour l'isolation multi-tenant.
     */
    @Query("SELECT mno FROM MinNightsOverride mno WHERE mno.property.id = :propertyId " +
           "AND mno.date = :date AND mno.organizationId = :orgId")
    Optional<MinNightsOverride> findByPropertyIdAndDate(
            @Param("propertyId") Long propertyId,
            @Param("date") LocalDate date,
            @Param("orgId") Long orgId);

    /**
     * Tous les overrides dans une plage de dates pour une propriete.
     * Charge en batch pour la resolution sur une plage et l'affichage planning.
     * Filtre par orgId pour l'isolation multi-tenant.
     */
    @Query("SELECT mno FROM MinNightsOverride mno WHERE mno.property.id = :propertyId " +
           "AND mno.date >= :from AND mno.date < :to AND mno.organizationId = :orgId " +
           "ORDER BY mno.date")
    List<MinNightsOverride> findByPropertyIdAndDateRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);
}
