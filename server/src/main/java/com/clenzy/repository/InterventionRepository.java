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

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.assignedUser.id = :userId AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByAssignedUserId(@Param("userId") Long userId, @Param("orgId") Long orgId);

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.teamId = :teamId AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByTeamId(@Param("teamId") Long teamId, @Param("orgId") Long orgId);

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.requestor.id = :requestorId AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByRequestorId(@Param("requestorId") Long requestorId, @Param("orgId") Long orgId);

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.type = :type AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByType(@Param("type") String type, @Param("orgId") Long orgId);

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.status = :status AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByStatus(@Param("status") String status, @Param("orgId") Long orgId);

    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.priority = :priority AND i.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByPriority(@Param("priority") String priority, @Param("orgId") Long orgId);

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
    long countByStatus(@Param("status") String status, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.priority = :priority AND i.organizationId = :orgId")
    long countByPriority(@Param("priority") String priority, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.type = :type AND i.organizationId = :orgId")
    long countByType(@Param("type") String type, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.organizationId = :orgId")
    long countTotal(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.assignedUser.keycloakId = :userKeycloakId AND i.organizationId = :orgId")
    long countByAssignedUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

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
     * Interventions pour le planning : filtrees par proprietes et plage de dates
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner " +
           "WHERE i.property.id IN :propertyIds " +
           "AND i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
           "ORDER BY i.scheduledDate ASC")
    List<Intervention> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("orgId") Long orgId);

    /**
     * Toutes les interventions pour le planning dans une plage de dates (admin/manager)
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner " +
           "WHERE i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
           "ORDER BY i.scheduledDate ASC")
    List<Intervention> findAllByDateRange(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("orgId") Long orgId);

    /**
     * Interventions pour le planning d'un owner specifique
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner " +
           "WHERE p.owner.keycloakId = :keycloakId " +
           "AND i.scheduledDate >= :fromDate AND i.scheduledDate <= :toDate " +
           "AND i.organizationId = :orgId " +
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
}
