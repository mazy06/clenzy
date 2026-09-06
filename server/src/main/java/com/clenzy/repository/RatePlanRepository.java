package com.clenzy.repository;

import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface RatePlanRepository extends JpaRepository<RatePlan, Long> {

    /**
     * Tous les plans actifs d'une propriete, tries par priorite DESC.
     * Charge en une seule query pour la resolution de prix en memoire.
     */
    @Query("SELECT rp FROM RatePlan rp WHERE rp.property.id = :propertyId " +
           "AND rp.isActive = true AND rp.organizationId = :orgId " +
           "ORDER BY rp.priority DESC")
    List<RatePlan> findActiveByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Plans par property et type.
     */
    @Query("SELECT rp FROM RatePlan rp WHERE rp.property.id = :propertyId " +
           "AND rp.type = :type AND rp.isActive = true AND rp.organizationId = :orgId " +
           "ORDER BY rp.priority DESC")
    List<RatePlan> findByPropertyIdAndType(
            @Param("propertyId") Long propertyId,
            @Param("type") RatePlanType type,
            @Param("orgId") Long orgId);

    /**
     * Tous les plans d'une propriete (actifs et inactifs).
     */
    @Query("SELECT rp FROM RatePlan rp WHERE rp.property.id = :propertyId " +
           "AND rp.organizationId = :orgId ORDER BY rp.type, rp.priority DESC")
    List<RatePlan> findAllByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Plans actifs de PLUSIEURS proprietes.
     *
     * <p>Les plans ne dependent PAS de la plage de dates : les recharger pour
     * chaque tranche de 30 jours du planning etait de la duplication pure.</p>
     */
    @Query("SELECT rp FROM RatePlan rp WHERE rp.property.id IN :propertyIds " +
           "AND rp.isActive = true AND rp.organizationId = :orgId " +
           "ORDER BY rp.property.id, rp.priority DESC")
    List<RatePlan> findActiveByPropertyIds(
            @Param("propertyIds") Set<Long> propertyIds,
            @Param("orgId") Long orgId);
}
