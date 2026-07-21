package com.clenzy.repository;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import com.clenzy.model.PaymentStatus;
import jakarta.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InterventionRepository extends JpaRepository<Intervention, Long> {

    /**
     * Requêtes optimisées avec FETCH JOIN et cache
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.property.id = :propertyId AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Interventions planifiées dans la fenêtre du dashboard overview. Org-scope
     * strict ; owner optionnel (HOST) ; assigné optionnel (rôles opérationnels :
     * un technicien ne voit que SES interventions). Sans join fetch.
     */
    @Query("SELECT i FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "AND i.scheduledDate >= :from AND i.scheduledDate < :toExclusive")
    List<Intervention> findForDashboardWindow(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId);

    /** Compteur d'interventions urgentes ouvertes (badge dashboard) — mêmes scopes optionnels. */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "AND i.priority = 'URGENT' AND i.status IN :statuses")
    long countUrgentForDashboard(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId,
            @Param("statuses") List<InterventionStatus> statuses);

    /** Compteur « paiements en attente » (interventions payantes non réglées) — dashboard. */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND i.paymentStatus = :pendingStatus "
        + "AND (i.estimatedCost > 0 OR i.actualCost > 0)")
    long countPendingPaymentsForDashboard(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("pendingStatus") com.clenzy.model.PaymentStatus pendingStatus);

    /**
     * Totaux financiers des rapports PDF sur la fenêtre planifiée [from, toExclusive) :
     * {@code [Long count, BigDecimal sumEstimatedCostPaid, BigDecimal sumEstimatedCost]}
     * (une seule ligne ; les SUM sont {@code null} si aucune ligne ne matche).
     * Org optionnelle ({@code null} = platform staff cross-org). Remplace le scan
     * findAll() + filtre dates en mémoire (audit perf 2026-07-21).
     */
    @Query("SELECT COUNT(i), "
        + "SUM(CASE WHEN i.paymentStatus = com.clenzy.model.PaymentStatus.PAID "
        + "THEN COALESCE(i.estimatedCost, 0) ELSE 0 END), "
        + "SUM(COALESCE(i.estimatedCost, 0)) "
        + "FROM Intervention i WHERE i.scheduledDate >= :from AND i.scheduledDate < :toExclusive "
        + "AND (:orgId IS NULL OR i.organizationId = :orgId)")
    List<Object[]> financialTotalsForPdfReport(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId);

    /**
     * Compteurs par statut sur la fenêtre planifiée [from, toExclusive) — rapports
     * PDF. Lignes {@code [InterventionStatus, Long count]}. Org optionnelle.
     */
    @Query("SELECT i.status, COUNT(i) FROM Intervention i "
        + "WHERE i.scheduledDate >= :from AND i.scheduledDate < :toExclusive "
        + "AND (:orgId IS NULL OR i.organizationId = :orgId) "
        + "GROUP BY i.status")
    List<Object[]> countByStatusInWindowForPdfReport(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId);

    /**
     * Répartition par statut (écran Rapports Baitly) — scopes optionnels :
     * org strict ; owner (HOST) ; assigné (rôles opérationnels). Lignes
     * {@code [InterventionStatus, Long count]}.
     */
    @Query("SELECT i.status, COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "GROUP BY i.status")
    List<Object[]> countByStatusForReport(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId);

    /**
     * Compteur + coût cumulé par type BRUT (répartition par type et ventilation
     * des coûts des Rapports Baitly). Coût = réel, repli devis, repli 0.
     * Lignes {@code [String type, Long count, BigDecimal cost]}.
     */
    @Query("SELECT i.type, COUNT(i), SUM(COALESCE(i.actualCost, i.estimatedCost, 0)) "
        + "FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "GROUP BY i.type")
    List<Object[]> countAndCostByTypeForReport(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId);

    /** Répartition par priorité (Rapports Baitly). Lignes {@code [String priority, Long count]}. */
    @Query("SELECT i.priority, COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "GROUP BY i.priority")
    List<Object[]> countByPriorityForReport(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId);

    /**
     * Compteurs et coûts mensuels par statut sur [from, toExclusive) — date
     * planifiée, repli date de création (parité avec l'ancien calcul client).
     * Lignes {@code [Integer year, Integer month, InterventionStatus status, Long count, BigDecimal cost]}.
     */
    @Query("SELECT YEAR(COALESCE(i.scheduledDate, i.createdAt)), MONTH(COALESCE(i.scheduledDate, i.createdAt)), "
        + "i.status, COUNT(i), SUM(COALESCE(i.actualCost, i.estimatedCost, 0)) "
        + "FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "AND (:assigneeId IS NULL OR i.assignedUser.id = :assigneeId) "
        + "AND COALESCE(i.scheduledDate, i.createdAt) >= :from "
        + "AND COALESCE(i.scheduledDate, i.createdAt) < :toExclusive "
        + "GROUP BY YEAR(COALESCE(i.scheduledDate, i.createdAt)), MONTH(COALESCE(i.scheduledDate, i.createdAt)), i.status")
    List<Object[]> monthlyCountsAndCostsForReport(
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("assigneeId") Long assigneeId);

    /**
     * Compteurs par équipe et statut — uniquement les interventions assignées
     * à une ÉQUIPE (assignedUser null + teamId présent, même convention que
     * {@code Intervention.getAssignedToType()}). Rapports Baitly, onglet Équipes.
     * Lignes {@code [Long teamId, InterventionStatus status, Long count]}.
     */
    @Query("SELECT i.teamId, i.status, COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId "
        + "AND i.assignedUser IS NULL AND i.teamId IS NOT NULL "
        + "AND (:ownerKc IS NULL OR i.property.owner.keycloakId = :ownerKc) "
        + "GROUP BY i.teamId, i.status")
    List<Object[]> countByTeamAndStatusForReport(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc);

    /**
     * Interventions d'un LOT de logements planifiées dans la fenêtre — agrégats
     * de coûts (PropertyPerformanceService). Volontairement SANS join fetch
     * (seuls scheduledDate et les coûts sont lus) : remplace l'appel
     * {@link #findByPropertyId} par logement (N+1).
     */
    @Query("SELECT i FROM Intervention i WHERE i.property.id IN :propertyIds AND i.organizationId = :orgId " +
           "AND i.scheduledDate >= :from AND i.scheduledDate < :toExclusive")
    List<Intervention> findByPropertyIdsAndScheduledDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDateTime from,
            @Param("toExclusive") LocalDateTime toExclusive,
            @Param("orgId") Long orgId);

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findAllWithRelations(Pageable pageable, @Param("orgId") Long orgId);

    // Utiliser EntityGraph pour charger les relations nécessaires avec pagination
    @EntityGraph(attributePaths = {"property", "property.owner", "assignedUser", "requestor"})
    @Query("SELECT DISTINCT i FROM Intervention i " +
           "WHERE (:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority) AND " +
           "(CAST(:startDate AS timestamp) IS NULL OR i.scheduledDate >= :startDate) AND " +
           "(CAST(:endDate AS timestamp) IS NULL OR i.scheduledDate < :endDate) AND " +
           "i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findByFiltersWithRelations(@Param("propertyId") Long propertyId,
                                                @Param("type") String type,
                                                @Param("status") InterventionStatus status,
                                                @Param("priority") String priority,
                                                Pageable pageable,
                                                @Param("orgId") Long orgId,
                                                @Param("startDate") LocalDateTime startDate,
                                                @Param("endDate") LocalDateTime endDate);

    /**
     * Trouver les interventions assignées à un utilisateur (individuellement ou via une équipe)
     */
    @EntityGraph(attributePaths = {"property", "property.owner", "assignedUser", "requestor"})
    @Query("SELECT DISTINCT i FROM Intervention i " +
           "WHERE (i.assignedUser.id = :userId OR " +
           "EXISTS (SELECT 1 FROM TeamMember tm WHERE tm.team.id = i.teamId AND tm.user.id = :userId)) AND " +
           "(:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority) AND " +
           "(CAST(:startDate AS timestamp) IS NULL OR i.scheduledDate >= :startDate) AND " +
           "(CAST(:endDate AS timestamp) IS NULL OR i.scheduledDate < :endDate) AND " +
           "(:orgId IS NULL OR i.organizationId = :orgId)")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findByAssignedUserOrTeamWithFilters(@Param("userId") Long userId,
                                                          @Param("propertyId") Long propertyId,
                                                          @Param("type") String type,
                                                          @Param("status") InterventionStatus status,
                                                          @Param("priority") String priority,
                                                          Pageable pageable,
                                                          @Param("orgId") Long orgId,
                                                          @Param("startDate") LocalDateTime startDate,
                                                          @Param("endDate") LocalDateTime endDate);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.status = :status AND i.organizationId = :orgId")
    long countByStatus(@Param("status") InterventionStatus status, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.priority = :priority AND i.organizationId = :orgId")
    long countByPriority(@Param("priority") String priority, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.type = :type AND i.organizationId = :orgId")
    long countByType(@Param("type") String type, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId")
    long countTotal(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.assignedUser.keycloakId = :userKeycloakId AND i.organizationId = :orgId")
    long countByAssignedUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    /** Score qualité housekeeper (MM-3D) : missions ménage complétées du user sur une fenêtre. */
    @Query("SELECT i FROM Intervention i WHERE i.assignedUser.id = :userId AND i.organizationId = :orgId " +
           "AND i.status = com.clenzy.model.InterventionStatus.COMPLETED " +
           "AND i.type IN :types AND i.completedAt >= :since")
    java.util.List<Intervention> findCompletedCleaningsSince(@Param("userId") Long userId,
                                                             @Param("orgId") Long orgId,
                                                             @Param("types") java.util.Collection<String> types,
                                                             @Param("since") java.time.LocalDateTime since);

    /** Équilibrage auto-assign (MM-3D) : missions OUVERTES du user planifiées un jour donné. */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.assignedUser.id = :userId AND i.organizationId = :orgId " +
           "AND i.status IN (com.clenzy.model.InterventionStatus.PENDING, com.clenzy.model.InterventionStatus.IN_PROGRESS) " +
           "AND i.scheduledDate >= :dayStart AND i.scheduledDate < :dayEnd")
    long countOpenOnDay(@Param("userId") Long userId, @Param("orgId") Long orgId,
                        @Param("dayStart") java.time.LocalDateTime dayStart,
                        @Param("dayEnd") java.time.LocalDateTime dayEnd);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.property.owner.keycloakId = :ownerKeycloakId AND i.organizationId = :orgId")
    long countByPropertyOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT i.id FROM Intervention i WHERE i.assignedUser.keycloakId = :userKeycloakId AND i.organizationId = :orgId")
    List<Long> findIdsByAssignedUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    /**
     * Vérifications d'existence
     */
    boolean existsByServiceRequestId(Long serviceRequestId);

    /**
     * Trouver une intervention par son ID de session Stripe
     * EntityGraph pour charger property, property.owner et requestor (nécessaire pour les notifications et le DTO)
     */
    @EntityGraph(attributePaths = {"property", "property.owner", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.stripeSessionId = :sessionId AND i.organizationId = :orgId")
    java.util.Optional<Intervention> findByStripeSessionId(@Param("sessionId") String sessionId, @Param("orgId") Long orgId);

    /**
     * Trouver une intervention par session Stripe SANS filtre organisation (pour les webhooks Stripe).
     */
    @EntityGraph(attributePaths = {"property", "property.owner", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.stripeSessionId = :sessionId")
    java.util.Optional<Intervention> findByStripeSessionId(@Param("sessionId") String sessionId);

    /**
     * Interventions impayees d'un host (paymentStatus != PAID et estimatedCost > 0)
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property WHERE i.requestor.id = :hostId " +
           "AND i.paymentStatus != com.clenzy.model.PaymentStatus.PAID " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND i.organizationId = :orgId " +
           "ORDER BY i.property.id, i.scheduledDate")
    List<Intervention> findUnpaidByHostId(@Param("hostId") Long hostId, @Param("orgId") Long orgId);

    /**
     * Somme des impayes d'un host
     */
    @Query("SELECT COALESCE(SUM(i.estimatedCost), 0) FROM Intervention i " +
           "WHERE i.requestor.id = :hostId " +
           "AND i.paymentStatus != com.clenzy.model.PaymentStatus.PAID " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND i.organizationId = :orgId")
    java.math.BigDecimal sumUnpaidByHostId(@Param("hostId") Long hostId, @Param("orgId") Long orgId);

    /**
     * Interventions NON RÉGLÉES d'un LOGEMENT (quel que soit le demandeur) : coût &gt; 0
     * et statut de paiement dû (null / PENDING / PARTIALLY_PAID / FAILED). Sert au scope
     * « logement supervisé » de l'assistant (detect/settle par propriété, pas par host).
     */
    @Query("SELECT i FROM Intervention i " +
           "LEFT JOIN FETCH i.property " +
           "LEFT JOIN FETCH i.requestor " +
           "LEFT JOIN i.serviceRequest sr " +
           "LEFT JOIN sr.property srp " +
           // Rattachement au logement par lien DIRECT (i.property) OU indirect via la
           // demande de service (sr.property) : un ménage encore « À payer » n'a souvent
           // pas de i.property alignée sur le logement, mais sa ServiceRequest le porte.
           // LEFT JOIN explicites → ne pas exclure les interventions sans ServiceRequest.
           "WHERE (i.property.id = :propertyId OR srp.id = :propertyId) " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 AND i.organizationId = :orgId " +
           "AND (i.paymentStatus IS NULL OR i.paymentStatus IN (" +
           "com.clenzy.model.PaymentStatus.PENDING, com.clenzy.model.PaymentStatus.PARTIALLY_PAID, " +
           "com.clenzy.model.PaymentStatus.FAILED)) " +
           "ORDER BY i.scheduledDate")
    List<Intervention> findUnpaidByProperty(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Historique des paiements — toutes interventions payantes (ADMIN/MANAGER, optionnellement par host)
     */
    @EntityGraph(attributePaths = {"property", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR i.paymentStatus = :paymentStatus) " +
           "AND (:hostId IS NULL OR i.requestor.id = :hostId) " +
           "AND i.organizationId = :orgId")
    Page<Intervention> findPaymentHistory(@Param("paymentStatus") PaymentStatus paymentStatus,
                                           @Param("hostId") Long hostId,
                                           Pageable pageable,
                                           @Param("orgId") Long orgId);

    /**
     * Historique des paiements — interventions d'un requestor specifique (HOST)
     */
    @EntityGraph(attributePaths = {"property", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.requestor.id = :requestorId " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR i.paymentStatus = :paymentStatus) " +
           "AND i.organizationId = :orgId")
    Page<Intervention> findPaymentHistoryByRequestor(@Param("requestorId") Long requestorId,
                                                      @Param("paymentStatus") PaymentStatus paymentStatus,
                                                      Pageable pageable,
                                                      @Param("orgId") Long orgId);

    /**
     * Liste des hosts distincts ayant des interventions payantes (pour filtre admin)
     */
    @Query("SELECT DISTINCT i.requestor.id, i.requestor.firstName, i.requestor.lastName " +
           "FROM Intervention i WHERE i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND i.requestor IS NOT NULL AND i.organizationId = :orgId ORDER BY i.requestor.lastName")
    List<Object[]> findDistinctHostsWithPayments(@Param("orgId") Long orgId);

    /**
     * Interventions pour le planning : filtrees par proprietes et plage de dates.
     * Exclut les interventions liees a une reservation masquee du planning
     * (reservation cancelled + hidden_from_planning=true).
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser " +
           "WHERE i.property.id IN :propertyIds " +
           "AND i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM Reservation r WHERE r.intervention.id = i.id " +
           "  AND r.hiddenFromPlanning = true AND r.status = 'cancelled') " +
           "ORDER BY i.scheduledDate ASC")
    List<Intervention> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("orgId") Long orgId);

    /**
     * Toutes les interventions pour le planning dans une plage de dates (admin/manager).
     * Exclut les interventions liees a une reservation masquee du planning.
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser " +
           "WHERE i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM Reservation r WHERE r.intervention.id = i.id " +
           "  AND r.hiddenFromPlanning = true AND r.status = 'cancelled') " +
           "ORDER BY i.scheduledDate ASC")
    List<Intervention> findAllByDateRange(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("orgId") Long orgId);

    /**
     * Interventions pour le planning d'un owner specifique.
     * Exclut les interventions liees a une reservation masquee du planning.
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser " +
           "WHERE p.owner.keycloakId = :keycloakId " +
           "AND i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM Reservation r WHERE r.intervention.id = i.id " +
           "  AND r.hiddenFromPlanning = true AND r.status = 'cancelled') " +
           "ORDER BY i.scheduledDate ASC")
    List<Intervention> findByOwnerKeycloakIdAndDateRange(
            @Param("keycloakId") String keycloakId,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("orgId") Long orgId);

    /**
     * Compter les interventions actives d'une equipe sur un creneau donne.
     * Utilise pour la detection de conflits lors de l'auto-assignation.
     */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.teamId = :teamId " +
           "AND i.status IN :activeStatuses " +
           "AND i.scheduledDate >= :rangeStart AND i.scheduledDate < :rangeEnd " +
           "AND i.organizationId = :orgId")
    long countActiveByTeamIdAndDateRange(
            @Param("teamId") Long teamId,
            @Param("activeStatuses") List<InterventionStatus> activeStatuses,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd,
            @Param("orgId") Long orgId);

    /**
     * Compter les interventions actives d'une equipe sur un creneau, TOUTES organisations confondues.
     * Indispensable pour les equipes SYSTEM qui servent plusieurs organisations :
     * verifier la vraie disponibilite globale, pas juste au sein d'une seule org.
     */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.teamId = :teamId " +
           "AND i.status IN :activeStatuses " +
           "AND i.scheduledDate >= :rangeStart AND i.scheduledDate < :rangeEnd")
    long countActiveByTeamIdAndDateRangeAnyOrg(
            @Param("teamId") Long teamId,
            @Param("activeStatuses") List<InterventionStatus> activeStatuses,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd);

    /**
     * Compter les interventions actives d'un utilisateur sur un creneau donne.
     * Utilise pour la detection de conflits par membre d'equipe.
     */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.assignedUser.id = :userId " +
           "AND i.status IN :activeStatuses " +
           "AND i.scheduledDate >= :rangeStart AND i.scheduledDate < :rangeEnd " +
           "AND i.organizationId = :orgId")
    long countActiveByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("activeStatuses") List<InterventionStatus> activeStatuses,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd,
            @Param("orgId") Long orgId);

    /**
     * Batch count of active interventions per user for a date range.
     * Returns pairs of [userId, count] to avoid N+1 in team availability checks.
     */
    @Query("SELECT i.assignedUser.id, COUNT(i) FROM Intervention i WHERE i.assignedUser.id IN :userIds " +
           "AND i.status IN :activeStatuses " +
           "AND i.scheduledDate >= :rangeStart AND i.scheduledDate < :rangeEnd " +
           "AND i.organizationId = :orgId " +
           "GROUP BY i.assignedUser.id")
    List<Object[]> countActiveByUserIdsAndDateRange(
            @Param("userIds") List<Long> userIds,
            @Param("activeStatuses") List<InterventionStatus> activeStatuses,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd,
            @Param("orgId") Long orgId);

    /**
     * Méthode de compatibilité pour les services existants
     */
    @Query("SELECT i FROM Intervention i WHERE " +
           "(:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority) AND " +
           "i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByFilters(@Param("propertyId") Long propertyId,
                                   @Param("type") String type,
                                   @Param("status") String status,
                                   @Param("priority") String priority,
                                   @Param("orgId") Long orgId);

    /**
     * Returns the keycloakId of the user assigned to the given intervention,
     * or null if no user is assigned. Avoids lazy-loading issues in controller
     * ownership checks (no open Hibernate session required).
     */
    @Query("SELECT u.keycloakId FROM Intervention i JOIN i.assignedUser u WHERE i.id = :interventionId")
    String findAssignedUserKeycloakIdById(@Param("interventionId") Long interventionId);

    /**
     * Interventions liees a une reservation via la ServiceRequest.
     * Une reservation peut avoir plusieurs interventions (menage, maintenance, check-in...).
     */
    @EntityGraph(attributePaths = {"property", "assignedUser", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.serviceRequest.reservationId = :reservationId " +
           "AND i.organizationId = :orgId ORDER BY i.scheduledDate ASC")
    List<Intervention> findByReservationId(@Param("reservationId") Long reservationId, @Param("orgId") Long orgId);

    /**
     * Interventions actives (par statut) pour un lot de proprietes, dans l'org.
     * Utilise par le widget KPI des cartes de la liste de proprietes pour signaler
     * une intervention en cours (menage / maintenance) sur la carte.
     */
    @Query("SELECT i FROM Intervention i WHERE i.property.id IN :propertyIds " +
           "AND i.status IN :statuses AND i.organizationId = :orgId")
    List<Intervention> findActiveByPropertyIds(@Param("propertyIds") List<Long> propertyIds,
            @Param("statuses") List<InterventionStatus> statuses,
            @Param("orgId") Long orgId);

    /**
     * Existe-t-il une intervention OUVERTE portant un marqueur donne dans ses
     * specialInstructions, sur cette propriete/org ? Idempotence des
     * interventions auto-generees (ex. batterie serrure critique F7a : marqueur
     * {@code [lock-battery:<deviceId>]} — pas de nouvelle intervention tant
     * qu'une intervention batterie est ouverte pour ce device).
     */
    @Query("SELECT COUNT(i) > 0 FROM Intervention i WHERE i.property.id = :propertyId " +
           "AND i.organizationId = :orgId AND i.status IN :openStatuses " +
           "AND i.specialInstructions LIKE CONCAT('%', :marker, '%')")
    boolean existsOpenByPropertyAndMarker(@Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId,
            @Param("openStatuses") List<InterventionStatus> openStatuses,
            @Param("marker") String marker);
}
