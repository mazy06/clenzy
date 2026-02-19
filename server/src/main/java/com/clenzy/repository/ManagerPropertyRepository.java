package com.clenzy.repository;

import com.clenzy.model.ManagerProperty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;

@Repository
public interface ManagerPropertyRepository extends JpaRepository<ManagerProperty, Long> {

    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerProperty> findByManagerId(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerProperty> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    ManagerProperty findByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerProperty> findByManagerIdWithPagination(@Param("managerId") Long managerId, Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerProperty> findByPropertyIdWithPagination(@Param("propertyId") Long propertyId, Pageable pageable, @Param("orgId") Long orgId);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(mp) FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.organizationId = :orgId")
    long countByManagerId(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(mp) FROM ManagerProperty mp WHERE mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    long countByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    boolean existsByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    boolean existsByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT mp.propertyId FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.organizationId = :orgId")
    List<Long> findPropertyIdsByManagerId(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    @Query("SELECT mp.managerId FROM ManagerProperty mp WHERE mp.propertyId = :propertyId AND mp.organizationId = :orgId")
    List<Long> findManagerIdsByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);
}
