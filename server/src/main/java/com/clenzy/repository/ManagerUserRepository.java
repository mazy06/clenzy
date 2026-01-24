package com.clenzy.repository;

import com.clenzy.model.ManagerUser;
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
public interface ManagerUserRepository extends JpaRepository<ManagerUser, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerUser> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.userId = :userId AND mu.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerUser> findByUserIdAndIsActiveTrue(@Param("userId") Long userId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    ManagerUser findByManagerIdAndUserId(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerUser> findAllByManagerIdAndUserId(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerUser> findByManagerIdAndIsActiveTrueWithPagination(@Param("managerId") Long managerId, Pageable pageable);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.userId = :userId AND mu.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerUser> findByUserIdAndIsActiveTrueWithPagination(@Param("userId") Long userId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(mu) FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.isActive = true")
    long countByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(mu) FROM ManagerUser mu WHERE mu.userId = :userId AND mu.isActive = true")
    long countByUserIdAndIsActiveTrue(@Param("userId") Long userId);
    
    @Query("SELECT COUNT(mu) FROM ManagerUser mu WHERE mu.managerId = :managerId")
    long countByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(mu) FROM ManagerUser mu WHERE mu.userId = :userId")
    long countByUserId(@Param("userId") Long userId);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(mu) > 0 THEN true ELSE false END FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId AND mu.isActive = true")
    boolean existsByManagerIdAndUserIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    @Query("SELECT CASE WHEN COUNT(mu) > 0 THEN true ELSE false END FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId")
    boolean existsByManagerIdAndUserId(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT mu.userId FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.isActive = true")
    List<Long> findUserIdsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mu.managerId FROM ManagerUser mu WHERE mu.userId = :userId AND mu.isActive = true")
    List<Long> findManagerIdsByUserIdAndIsActiveTrue(@Param("userId") Long userId);
}
