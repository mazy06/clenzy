package com.clenzy.repository;

import com.clenzy.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import jakarta.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long>, JpaSpecificationExecutor<ServiceRequest> {
    /**
     * Requêtes optimisées avec FETCH JOIN et cache
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.user = :user")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByUser(@Param("user") User user);
    
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.property = :property")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByProperty(@Param("property") Property property);
    
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.status = :status AND sr.desiredDate BETWEEN :start AND :end")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByStatusAndDesiredDateBetween(
        @Param("status") RequestStatus status, 
        @Param("start") LocalDateTime start, 
        @Param("end") LocalDateTime end
    );
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findAllWithRelationsPageable(Pageable pageable);
    
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.user.keycloakId = :userKeycloakId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findByUserKeycloakIdWithRelations(@Param("userKeycloakId") String userKeycloakId, Pageable pageable);
    
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.property.owner.keycloakId = :ownerKeycloakId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findByPropertyOwnerKeycloakIdWithRelations(@Param("ownerKeycloakId") String ownerKeycloakId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.user.keycloakId = :userKeycloakId")
    long countByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.property.owner.keycloakId = :ownerKeycloakId")
    long countByPropertyOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT sr.id FROM ServiceRequest sr WHERE sr.user.keycloakId = :userKeycloakId")
    List<Long> findIdsByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    /**
     * Méthode de compatibilité pour les services existants
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findAllWithRelations();
}


