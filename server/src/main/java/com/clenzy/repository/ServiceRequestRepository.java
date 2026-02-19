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
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.user = :user AND sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByUser(@Param("user") User user, @Param("orgId") Long orgId);

    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.property = :property AND sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByProperty(@Param("property") Property property, @Param("orgId") Long orgId);

    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.status = :status AND sr.desiredDate BETWEEN :start AND :end AND sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findByStatusAndDesiredDateBetween(
        @Param("status") RequestStatus status,
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end,
        @Param("orgId") Long orgId
    );

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findAllWithRelationsPageable(Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.user.keycloakId = :userKeycloakId AND sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findByUserKeycloakIdWithRelations(@Param("userKeycloakId") String userKeycloakId, Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.property.owner.keycloakId = :ownerKeycloakId AND sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ServiceRequest> findByPropertyOwnerKeycloakIdWithRelations(@Param("ownerKeycloakId") String ownerKeycloakId, Pageable pageable, @Param("orgId") Long orgId);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.user.keycloakId = :userKeycloakId AND sr.organizationId = :orgId")
    long countByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.property.owner.keycloakId = :ownerKeycloakId AND sr.organizationId = :orgId")
    long countByPropertyOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT sr.id FROM ServiceRequest sr WHERE sr.user.keycloakId = :userKeycloakId AND sr.organizationId = :orgId")
    List<Long> findIdsByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    /**
     * Méthode de compatibilité pour les services existants
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ServiceRequest> findAllWithRelations(@Param("orgId") Long orgId);
}
