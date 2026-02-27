package com.clenzy.repository;

import com.clenzy.model.YieldRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface YieldRuleRepository extends JpaRepository<YieldRule, Long> {

    /**
     * Regles de yield actives pour une propriete (specifiques + globales).
     * Triees par priorite decroissante.
     */
    @Query("SELECT yr FROM YieldRule yr WHERE " +
           "(yr.property.id = :propertyId OR yr.property IS NULL) " +
           "AND yr.isActive = true AND yr.organizationId = :orgId " +
           "ORDER BY yr.priority DESC")
    List<YieldRule> findActiveByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Regles de yield globales (property = null), actives.
     */
    @Query("SELECT yr FROM YieldRule yr WHERE yr.property IS NULL " +
           "AND yr.isActive = true AND yr.organizationId = :orgId " +
           "ORDER BY yr.priority DESC")
    List<YieldRule> findActiveGlobal(@Param("orgId") Long orgId);

    /**
     * Toutes les regles pour une propriete (actives et inactives).
     */
    @Query("SELECT yr FROM YieldRule yr WHERE " +
           "(yr.property.id = :propertyId OR yr.property IS NULL) " +
           "AND yr.organizationId = :orgId ORDER BY yr.priority DESC")
    List<YieldRule> findAllByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);
}
