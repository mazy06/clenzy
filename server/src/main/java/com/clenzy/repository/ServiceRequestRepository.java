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
     * Demandes de service impayées de toute l'organisation.
     *
     * Le bloc « à traiter » du dashboard agrège au niveau organisation : il ne
     * peut pas boucler logement par logement, d'où l'absence de filtre logement
     * par rapport à {@code findUnpaidByProperty}.
     *
     * <p>Le statut est restreint à {@code AWAITING_PAYMENT}, et non « tout sauf
     * annulé/refusé » : c'est exactement la condition que
     * {@code ServiceRequestPaymentPersistence.loadPayable} exige pour ouvrir une session de
     * paiement. Sans cette restriction, la file proposait de régler des
     * prestations que le serveur refuse ensuite de facturer, et le clic finissait
     * sur « Erreur lors de la création de la session de paiement ».</p>
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property " +
           "WHERE sr.organizationId = :orgId " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 " +
           "AND (sr.paymentStatus IS NULL OR sr.paymentStatus IN (" +
           "com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.PARTIALLY_PAID, " +
           "com.clenzy.model.PaymentStatus.FAILED)) " +
           "AND sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
           "ORDER BY sr.desiredDate")
    List<ServiceRequest> findUnpaidForOrg(@Param("orgId") Long orgId);

    /**
     * Prestations restées sans prestataire après un cycle complet de recherche.
     *
     * <p>Une demande naît en {@code PENDING} et n'en sort que si quelqu'un lui
     * est assigné — automatiquement à la création, ou par le scheduler qui
     * repasse toutes les 15 minutes. Rester en {@code PENDING} juste après la
     * création est donc normal ; l'être encore un cycle plus tard ne l'est pas.</p>
     *
     * <p>D'où le seul critère retenu : {@code createdAt} antérieur à
     * {@code staleBefore} (l'appelant passe « maintenant moins un cycle »). Il
     * couvre d'un coup les trois façons de rester bloqué, sans en oublier une :
     * les dix tentatives épuisées ({@code autoAssignStatus = 'exhausted'}), la
     * demande créée déjà assignée que plus personne ne reprend, et celle sans
     * logement ni date qui boucle sans jamais escalader. Énumérer ces cas un par
     * un laissait passer la situation la plus courante : la recherche est encore
     * « en cours » depuis des jours, et rien ne le signale.</p>
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property " +
           "WHERE sr.organizationId = :orgId " +
           "AND sr.status = com.clenzy.model.RequestStatus.PENDING " +
           "AND sr.createdAt < :staleBefore " +
           "ORDER BY sr.desiredDate")
    List<ServiceRequest> findStuckUnassignedForOrg(@Param("orgId") Long orgId,
                                                   @Param("staleBefore") LocalDateTime staleBefore);

    /**
     * Demandes de service RÉELLEMENT PAYABLES d'un logement : coût &gt; 0, statut de
     * paiement dû (null / PENDING / PARTIALLY_PAID / FAILED) et demande en
     * {@code AWAITING_PAYMENT}. Sert à la carte « demande de service impayée ».
     *
     * <p><b>Le statut de la demande compte autant que celui du paiement.</b> Le
     * critère portait seulement sur « pas annulée, pas refusée » : une demande
     * encore en {@code PENDING} — travail non commencé, donc rien à payer —
     * produisait une carte « Régler ». Le clic partait vers
     * {@code create-payment-session}, qui exige {@code AWAITING_PAYMENT} et
     * refusait par 400. La carte ne pouvait qu'échouer.</p>
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property WHERE sr.property.id = :propertyId " +
           "AND sr.estimatedCost IS NOT NULL AND sr.estimatedCost > 0 AND sr.organizationId = :orgId " +
           "AND (sr.paymentStatus IS NULL OR sr.paymentStatus IN (" +
           "com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.PARTIALLY_PAID, " +
           "com.clenzy.model.PaymentStatus.FAILED)) " +
           "AND sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
           "ORDER BY sr.desiredDate")
    List<ServiceRequest> findUnpaidByProperty(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Demandes dont l'ACOMPTE est exigible : chantier pas encore commence, devis
     * approuve portant un acompte, acompte non encaisse.
     *
     * <p>Un acompte se regle AVANT le travail — c'est sa raison d'etre :
     * l'intervenant bloque sa date des reception. Il est donc du precisement
     * quand la demande est en {@code PENDING}, moment ou {@link
     * #findUnpaidByProperty} ne rend rien (rien a facturer encore). Sans cette
     * requete, l'acompte n'apparaitrait nulle part.</p>
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property "
           + "WHERE sr.property.id = :propertyId AND sr.organizationId = :orgId "
           + "AND sr.status = com.clenzy.model.RequestStatus.PENDING "
           + "AND EXISTS (SELECT 1 FROM Intervention i, ServiceQuote q "
           + "            WHERE i.serviceRequest = sr AND q.interventionId = i.id "
           + "              AND q.organizationId = :orgId "
           + "              AND q.status = com.clenzy.model.ServiceQuote$Status.APPROVED "
           + "              AND q.depositAmount IS NOT NULL AND q.depositAmount > 0 "
           + "              AND q.depositPaidAt IS NULL) "
           + "ORDER BY sr.desiredDate")
    List<ServiceRequest> findDepositDueByProperty(@Param("propertyId") Long propertyId,
                                                  @Param("orgId") Long orgId);

    /** Memes criteres que {@link #findDepositDueByProperty}, agreges par logement. */
    @Query("SELECT sr.property.id, COUNT(sr) FROM ServiceRequest sr "
           + "WHERE sr.organizationId = :orgId "
           + "AND sr.status = com.clenzy.model.RequestStatus.PENDING "
           + "AND EXISTS (SELECT 1 FROM Intervention i, ServiceQuote q "
           + "            WHERE i.serviceRequest = sr AND q.interventionId = i.id "
           + "              AND q.organizationId = :orgId "
           + "              AND q.status = com.clenzy.model.ServiceQuote$Status.APPROVED "
           + "              AND q.depositAmount IS NOT NULL AND q.depositAmount > 0 "
           + "              AND q.depositPaidAt IS NULL) "
           + "GROUP BY sr.property.id")
    List<Object[]> countDepositDueByPropertyForOrg(@Param("orgId") Long orgId);

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
           "AND sr.status = com.clenzy.model.RequestStatus.AWAITING_PAYMENT " +
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
     * SR d'une organisation par statut de paiement (backfill wallet : rejoue les
     * paiements PAID dans le ledger). Remplace le scan findAll() + filtre memoire
     * cross-org de WalletService (audit perf 2026-07-21).
     */
    @Query("SELECT sr FROM ServiceRequest sr WHERE sr.organizationId = :orgId AND sr.paymentStatus = :paymentStatus")
    List<ServiceRequest> findByOrganizationIdAndPaymentStatus(
        @Param("orgId") Long orgId, @Param("paymentStatus") PaymentStatus paymentStatus);

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
