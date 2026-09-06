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

    /**
     * Overrides dans une plage de dates pour PLUSIEURS proprietes.
     *
     * <p>Le planning affiche N logements sur une meme plage : une requete par
     * logement multipliait les allers-retours HTTP jusqu'a saturer le quota de
     * l'API (300 req/min par utilisateur). Un seul appel les couvre tous.</p>
     */
    @Query("SELECT mno FROM MinNightsOverride mno WHERE mno.property.id IN :propertyIds " +
           "AND mno.date >= :from AND mno.date < :to AND mno.organizationId = :orgId " +
           "ORDER BY mno.property.id, mno.date")
    List<MinNightsOverride> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);
}
