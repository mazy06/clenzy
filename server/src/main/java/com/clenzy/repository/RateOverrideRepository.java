package com.clenzy.repository;

import com.clenzy.model.RateOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
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

    /**
     * Overrides de PLUSIEURS proprietes sur une plage.
     *
     * <p>Le planning resout les prix de N logements sur la meme fenetre : une
     * requete par logement et par tranche faisait 50 allers-retours la ou un
     * seul suffit. Borne haute EXCLUSIVE, comme la variante mono-propriete.</p>
     */
    @Query("SELECT ro FROM RateOverride ro WHERE ro.property.id IN :propertyIds " +
           "AND ro.date >= :from AND ro.date < :to AND ro.organizationId = :orgId " +
           "ORDER BY ro.property.id, ro.date")
    List<RateOverride> findByPropertyIdsAndDateRange(
            @Param("propertyIds") Set<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);
}
