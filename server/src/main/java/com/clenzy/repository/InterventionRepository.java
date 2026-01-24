package com.clenzy.repository;

import com.clenzy.model.Intervention;
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
    
    @Query("SELECT i FROM Intervention i LEFT JOIN FETCH i.property p LEFT JOIN FETCH p.owner LEFT JOIN FETCH i.assignedUser LEFT JOIN FETCH i.requestor WHERE " +
           "(:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority)")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Intervention> findByFiltersWithRelations(@Param("propertyId") Long propertyId,
                                                @Param("type") String type,
                                                @Param("status") String status,
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
