package com.clenzy.repository;

import com.clenzy.model.Portfolio;
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
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {

    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByManagerId(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    @Query("SELECT p FROM Portfolio p WHERE p.isActive = true AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByIsActiveTrue(@Param("orgId") Long orgId);

    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByManagerIdWithPagination(@Param("managerId") Long managerId, Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT p FROM Portfolio p WHERE p.isActive = true AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByIsActiveTrueWithPagination(Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true AND p.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByManagerIdAndIsActiveTrueWithPagination(@Param("managerId") Long managerId, Pageable pageable, @Param("orgId") Long orgId);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.manager.id = :managerId AND p.organizationId = :orgId")
    long countByManagerId(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.isActive = true AND p.organizationId = :orgId")
    long countByIsActiveTrue(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true AND p.organizationId = :orgId")
    long countByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true AND p.organizationId = :orgId")
    boolean existsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT p.id FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true AND p.organizationId = :orgId")
    List<Long> findIdsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("orgId") Long orgId);
}
