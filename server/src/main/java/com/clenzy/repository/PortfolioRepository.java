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
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT p FROM Portfolio p WHERE p.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByIsActiveTrue();
    
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Portfolio> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByManagerIdWithPagination(@Param("managerId") Long managerId, Pageable pageable);
    
    @Query("SELECT p FROM Portfolio p WHERE p.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByIsActiveTrueWithPagination(Pageable pageable);
    
    @Query("SELECT p FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Portfolio> findByManagerIdAndIsActiveTrueWithPagination(@Param("managerId") Long managerId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.manager.id = :managerId")
    long countByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.isActive = true")
    long countByIsActiveTrue();
    
    @Query("SELECT COUNT(p) FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true")
    long countByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true")
    boolean existsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT p.id FROM Portfolio p WHERE p.manager.id = :managerId AND p.isActive = true")
    List<Long> findIdsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
}
