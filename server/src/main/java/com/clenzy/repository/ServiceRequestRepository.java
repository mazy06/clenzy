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
     * Compteurs du dashboard overview sur la fenêtre de la période (créées dans
     * la fenêtre). Org-scope strict, owner optionnel (HOST).
     */
    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR sr.property.owner.keycloakId = :ownerKc) "
        + "AND sr.createdAt >= :from AND sr.createdAt < :toExclusive")
    long countWindowForDashboard(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc);

    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR sr.property.owner.keycloakId = :ownerKc) "
        + "AND sr.createdAt >= :from AND sr.createdAt < :toExclusive "
        + "AND sr.status IN :statuses")
    long countWindowByStatusesForDashboard(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("statuses") List<RequestStatus> statuses);

    /** Compteur « paiements en attente » (demandes en attente de paiement) — dashboard. */
    @Query("SELECT COUNT(sr) FROM ServiceRequest sr WHERE sr.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR sr.property.owner.keycloakId = :ownerKc) "
        + "AND sr.status = :status")
    long countByStatusForDashboard(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("status") RequestStatus status);

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

    /**
     * Demandes de service NON RÉGLÉES d'un logement : coût &gt; 0, statut de paiement dû
     * (null / PENDING / PARTIALLY_PAID / FAILED) et non annulée/refusée. Sert à la carte
     * déterministe « demande de service impayée » du Superviseur.
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property WHERE sr.property.id = :propertyId " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 AND sr.organizationId = :orgId " +
           "AND (sr.paymentStatus IS NULL OR sr.paymentStatus IN (" +
           "com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.PARTIALLY_PAID, " +
           "com.clenzy.model.PaymentStatus.FAILED)) " +
           "AND sr.status NOT IN (com.clenzy.model.RequestStatus.CANCELLED, com.clenzy.model.RequestStatus.REJECTED) " +
           "ORDER BY sr.desiredDate")
    List<ServiceRequest> findUnpaidByProperty(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Nb de demandes de service impayées PAR logement pour toute l'org (pastilles
     * planning) — mêmes critères que {@link #findUnpaidByProperty}, agrégé :
     * {@code [propertyId, count]} par ligne.
     */
    @Query("SELECT sr.property.id, COUNT(sr) FROM ServiceRequest sr WHERE sr.organizationId = :orgId " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 " +
           "AND (sr.paymentStatus IS NULL OR sr.paymentStatus IN (" +
           "com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.PARTIALLY_PAID, " +
           "com.clenzy.model.PaymentStatus.FAILED)) " +
           "AND sr.status NOT IN (com.clenzy.model.RequestStatus.CANCELLED, com.clenzy.model.RequestStatus.REJECTED) " +
           "GROUP BY sr.property.id")
    List<Object[]> countUnpaidByPropertyForOrg(@Param("orgId") Long orgId);

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
     * Planning: SR en AWAITING_PAYMENT filtrees par propertyIds et plage de dates.
     * Exclut les SR liees a une reservation masquee du planning (cancelled + hidden).
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.status = :status AND sr.property.id IN :propertyIds " +
           "AND sr.desiredDate BETWEEN :start AND :end AND sr.organizationId = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM Reservation r WHERE r.id = sr.reservationId " +
           "  AND r.hiddenFromPlanning = true AND r.status = 'cancelled')")
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

    /**
     * ServiceRequests liees a une reservation (via reservationId).
     * Utilise par ICalImportService pour annuler les menages lors d'une annulation OTA.
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.reservationId = :reservationId AND sr.organizationId = :orgId")
    List<ServiceRequest> findByReservationId(@Param("reservationId") Long reservationId, @Param("orgId") Long orgId);

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

    // ── Flux deterministes (consumer Kafka / scheduler — pas de TenantContext) ──

    /**
     * SR creee par un flux automatique, retrouvee par sa cle d'idempotence
     * (ex. AUTO_CLEANING:propertyId:checkIn:checkOut). orgId explicite : hors
     * requete HTTP le filtre Hibernate n'est pas garanti actif.
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user " +
           "WHERE sr.autoFlowKey = :autoFlowKey AND sr.organizationId = :orgId")
    Optional<ServiceRequest> findByAutoFlowKey(
        @Param("autoFlowKey") String autoFlowKey, @Param("orgId") Long orgId);

    /**
     * Verrou advisory TRANSACTIONNEL sur la cle de menage auto : serialise les
     * createurs concurrents du MEME sejour (2 fireTrigger simultanes, ou course
     * moteur x filet backfill). Le perdant attend le commit du gagnant, voit sa
     * demande au check d'existence et sort en skip propre — au lieu de percuter
     * l'index unique 0307, ce qui marquerait sa transaction rollback-only (le
     * catch de DataIntegrityViolationException en aval ne peut alors plus rien
     * sauver : UnexpectedRollbackException au commit — bug revele par
     * AutomationConcurrencyIT, strategie de tests vague T3). Relache
     * automatiquement en fin de transaction.
     */
    @Query(value = "SELECT pg_advisory_xact_lock(hashtext(:autoFlowKey))", nativeQuery = true)
    Object acquireAutoFlowKeyLock(@Param("autoFlowKey") String autoFlowKey);
}
