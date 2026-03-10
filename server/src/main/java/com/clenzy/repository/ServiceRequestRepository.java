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
import java.util.Optional;

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

    /**
     * Planning: SR en AWAITING_PAYMENT filtrees par propertyIds et plage de dates
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.status = :status AND sr.property.id IN :propertyIds " +
           "AND sr.desiredDate BETWEEN :start AND :end AND sr.organizationId = :orgId")
    List<ServiceRequest> findByStatusAndPropertyIdsAndDesiredDateBetween(
        @Param("status") RequestStatus status,
        @Param("propertyIds") List<Long> propertyIds,
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end,
        @Param("orgId") Long orgId
    );

    /**
     * Find service requests by property ID (for channel sync: Airbnb, Booking, iCal update/cancel)
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.property.id = :propertyId AND sr.organizationId = :orgId")
    List<ServiceRequest> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Find service request by Stripe session ID (for webhook callback, no orgId filter)
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user WHERE sr.stripeSessionId = :sessionId")
    Optional<ServiceRequest> findByStripeSessionId(@Param("sessionId") String sessionId);

    // ── Payment history : SR en AWAITING_PAYMENT ───────────────────────────────

    /**
     * SR AWAITING_PAYMENT pour l'historique de paiement — ADMIN/MANAGER.
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR sr.paymentStatus = :paymentStatus) " +
           "AND (:hostId IS NULL OR sr.user.id = :hostId) " +
           "AND sr.organizationId = :orgId")
    Page<ServiceRequest> findPaymentHistory(
        @Param("paymentStatus") PaymentStatus paymentStatus,
        @Param("hostId") Long hostId,
        Pageable pageable,
        @Param("orgId") Long orgId);

    /**
     * SR AWAITING_PAYMENT pour l'historique de paiement — HOST (ses propres SR).
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.user.id = :userId " +
           "AND sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR sr.paymentStatus = :paymentStatus) " +
           "AND sr.organizationId = :orgId")
    Page<ServiceRequest> findPaymentHistoryByUser(
        @Param("userId") Long userId,
        @Param("paymentStatus") PaymentStatus paymentStatus,
        Pageable pageable,
        @Param("orgId") Long orgId);

    /**
     * Tous les SR AWAITING_PAYMENT pour le summary (calcul totalPending).
     */
    @Query("SELECT sr FROM ServiceRequest sr " +
           "WHERE sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 " +
           "AND sr.organizationId = :orgId")
    List<ServiceRequest> findAllAwaitingPayment(@Param("orgId") Long orgId);

    // ── Auto-assignation retry (scheduler context — pas de TenantContext) ────────

    /**
     * SR PENDING non-assignees eligibles pour retry, pour une organisation donnee.
     * LEFT JOIN FETCH sr.property obligatoire : hors web request (pas d'Open Session in View).
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.status = 'PENDING' AND sr.assignedToId IS NULL " +
           "AND COALESCE(sr.autoAssignRetryCount, 0) < :maxRetries " +
           "AND sr.organizationId = :orgId")
    List<ServiceRequest> findPendingUnassignedForRetry(
        @Param("maxRetries") int maxRetries, @Param("orgId") Long orgId);

    /**
     * Organisations ayant des SR pending non-assignees eligibles pour retry.
     */
    @Query("SELECT DISTINCT sr.organizationId FROM ServiceRequest sr " +
           "WHERE sr.status = 'PENDING' AND sr.assignedToId IS NULL " +
           "AND COALESCE(sr.autoAssignRetryCount, 0) < :maxRetries")
    List<Long> findOrganizationIdsWithPendingUnassigned(@Param("maxRetries") int maxRetries);
}
