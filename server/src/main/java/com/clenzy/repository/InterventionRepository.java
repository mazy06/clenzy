package com.clenzy.repository;

import com.clenzy.model.Intervention;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterventionRepository extends JpaRepository<Intervention, Long> {
    
    // Trouver les interventions par propriété
    List<Intervention> findByPropertyId(Long propertyId);
    
    // Trouver les interventions assignées à un utilisateur
    List<Intervention> findByAssignedUserId(Long userId);
    
    // Trouver les interventions assignées à une équipe
    List<Intervention> findByTeamId(Long teamId);
    
    // Trouver les interventions demandées par un utilisateur
    List<Intervention> findByRequestorId(Long requestorId);
    
    // Trouver les interventions par type
    List<Intervention> findByType(String type);
    
    // Trouver les interventions par statut
    List<Intervention> findByStatus(String status);
    
    // Trouver les interventions par priorité
    List<Intervention> findByPriority(String priority);
    
    // Recherche combinée
    @Query("SELECT i FROM Intervention i WHERE " +
           "(:propertyId IS NULL OR i.property.id = :propertyId) AND " +
           "(:type IS NULL OR i.type = :type) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:priority IS NULL OR i.priority = :priority)")
    List<Intervention> findByFilters(@Param("propertyId") Long propertyId,
                                   @Param("type") String type,
                                   @Param("status") String status,
                                   @Param("priority") String priority);
    
    // Compter les interventions par statut
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.status = :status")
    long countByStatus(@Param("status") String status);
    
    // Compter les interventions par priorité
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.priority = :priority")
    long countByPriority(@Param("priority") String priority);
    
    // Compter les interventions par type
    @Query("SELECT COUNT(i) FROM Intervention i WHERE i.type = :type")
    long countByType(@Param("type") String type);
    
    // Compter le total des interventions
    @Query("SELECT COUNT(i) FROM Intervention i")
    long countTotal();
    
    // Vérifier si une intervention existe déjà pour une demande de service
    boolean existsByServiceRequestId(Long serviceRequestId);
}
