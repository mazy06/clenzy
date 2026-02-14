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
import java.util.List;

@Repository
public interface InterventionRepository extends JpaRepository<Intervention, Long> {
    
    /**
     * Requêtes optimisées avec FETCH JOIN et cache
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.property.id = :propertyId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByPropertyId(@Param("propertyId") Long propertyId);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.assignedUser.id = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByAssignedUserId(@Param("userId") Long userId);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.teamId = :teamId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByTeamId(@Param("teamId") Long teamId);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.requestor.id = :requestorId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByRequestorId(@Param("requestorId") Long requestorId);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.type = :type")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByType(@Param("type") String type);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.status = :status")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByStatus(@Param("status") String status);
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE i.priority = :priority")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByPriority(@Param("priority") String priority);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findAllWithRelations(Pageable pageable);
    
    // Utiliser EntityGraph pour charger les relations nécessaires avec pagination
    @EntityGraph(attributePaths = {"property", "property.owner", "assignedUser", "requestor"})
    @Query("SELECT DISTINCT i FROM Intervention i " +
           "WHERE (:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority)")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findByFiltersWithRelations(@Param("propertyId") Long propertyId,
                                                @Param("type") String type,
                                                @Param("status") InterventionStatus status,
                                                @Param("priority") String priority,
                                                Pageable pageable);
    
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
           "(:priority IS NULL OR i.priority = :priority)")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findByAssignedUserOrTeamWithFilters(@Param("userId") Long userId,
                                                          @Param("propertyId") Long propertyId,
                                                          @Param("type") String type,
                                                          @Param("status") InterventionStatus status,
                                                          @Param("priority") String priority,
                                                          Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.status = :status")
    long countByStatus(@Param("status") String status);
    
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.priority = :priority")
    long countByPriority(@Param("priority") String priority);
    
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.type = :type")
    long countByType(@Param("type") String type);
    
    @Query("SELECT COUNT(i) FROM Intervention i")
    long countTotal();
    
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.assignedUser.keycloakId = :userKeycloakId")
    long countByAssignedUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.property.owner.keycloakId = :ownerKeycloakId")
    long countByPropertyOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT i.id FROM Intervention i WHERE i.assignedUser.keycloakId = :userKeycloakId")
    List<Long> findIdsByAssignedUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    /**
     * Vérifications d'existence
     */
    boolean existsByServiceRequestId(Long serviceRequestId);
    
    /**
     * Trouver une intervention par son ID de session Stripe
     */
    @Query("SELECT i FROM Intervention i WHERE i.stripeSessionId = :sessionId")
    java.util.Optional<Intervention> findByStripeSessionId(@Param("sessionId") String sessionId);
    
    /**
     * Interventions impayees d'un host (paymentStatus != PAID et estimatedCost > 0)
     */
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property WHERE i.requestor.id = :hostId " +
           "AND i.paymentStatus != com.clenzy.model.PaymentStatus.PAID " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "ORDER BY i.property.id, i.scheduledDate")
    List<Intervention> findUnpaidByHostId(@Param("hostId") Long hostId);

    /**
     * Somme des impayes d'un host
     */
    @Query("SELECT COALESCE(SUM(i.estimatedCost), 0) FROM Intervention i " +
           "WHERE i.requestor.id = :hostId " +
           "AND i.paymentStatus != com.clenzy.model.PaymentStatus.PAID " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0")
    java.math.BigDecimal sumUnpaidByHostId(@Param("hostId") Long hostId);

    /**
     * Historique des paiements — toutes interventions payantes (ADMIN/MANAGER, optionnellement par host)
     */
    @EntityGraph(attributePaths = {"property", "requestor"})
    @Query("SELECT i FROM Intervention i WHERE i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR i.paymentStatus = :paymentStatus) " +
           "AND (:hostId IS NULL OR i.requestor.id = :hostId)")
    Page<Intervention> findPaymentHistory(@Param("paymentStatus") PaymentStatus paymentStatus,
                                           @Param("hostId") Long hostId,
                                           Pageable pageable);

    /**
     * Historique des paiements — interventions d'un requestor specifique (HOST)
     */
    @EntityGraph(attributePaths = {"property"})
    @Query("SELECT i FROM Intervention i WHERE i.requestor.id = :requestorId " +
           "AND i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND (:paymentStatus IS NULL OR i.paymentStatus = :paymentStatus)")
    Page<Intervention> findPaymentHistoryByRequestor(@Param("requestorId") Long requestorId,
                                                      @Param("paymentStatus") PaymentStatus paymentStatus,
                                                      Pageable pageable);

    /**
     * Liste des hosts distincts ayant des interventions payantes (pour filtre admin)
     */
    @Query("SELECT DISTINCT i.requestor.id, i.requestor.firstName, i.requestor.lastName " +
           "FROM Intervention i WHERE i.estimatedCost IS NOT NULL AND i.estimatedCost > 0 " +
           "AND i.requestor IS NOT NULL ORDER BY i.requestor.lastName")
    List<Object[]> findDistinctHostsWithPayments();

    /**
     * Méthode de compatibilité pour les services existants
     */
    @Query("SELECT i FROM Intervention i WHERE " +
           "(:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority)")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Intervention> findByFilters(@Param("propertyId") Long propertyId,
                                   @Param("type") String type,
                                   @Param("status") String status,
                                   @Param("priority") String priority);
}
