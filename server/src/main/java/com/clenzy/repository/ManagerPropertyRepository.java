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
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerProperty> findByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerProperty> findByPropertyId(@Param("propertyId") Long propertyId);
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    ManagerProperty findByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerProperty> findByManagerIdWithPagination(@Param("managerId") Long managerId, Pageable pageable);
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerProperty> findByPropertyIdWithPagination(@Param("propertyId") Long propertyId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(mp) FROM ManagerProperty mp WHERE mp.managerId = :managerId")
    long countByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(mp) FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    long countByPropertyId(@Param("propertyId") Long propertyId);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId")
    boolean existsByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId);
    
    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    boolean existsByPropertyId(@Param("propertyId") Long propertyId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT mp.propertyId FROM ManagerProperty mp WHERE mp.managerId = :managerId")
    List<Long> findPropertyIdsByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT mp.managerId FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    List<Long> findManagerIdsByPropertyId(@Param("propertyId") Long propertyId);
}
