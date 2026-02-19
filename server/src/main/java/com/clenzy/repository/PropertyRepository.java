package com.clenzy.repository;

import com.clenzy.model.Property;
import com.clenzy.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.util.List;

public interface PropertyRepository extends JpaRepository<Property, Long>, JpaSpecificationExecutor<Property> {
    List<Property> findByOwner(User owner);
    List<Property> findByOwnerId(Long ownerId);
    
    /**
     * Requête optimisée avec FETCH JOIN pour éviter les N+1
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.owner
        WHERE p.owner.keycloakId = :ownerKeycloakId
        AND p.organizationId = :orgId
        """)
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.readOnly", value = "true")
    })
    List<Property> findByOwnerKeycloakIdWithRelations(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête pour les propriétés avec managers (optimisée)
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.owner
        WHERE p.owner.keycloakId = :ownerKeycloakId
        AND p.organizationId = :orgId
        """)
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Property> findWithManagersByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête pour compter les propriétés (sans charger les données)
     */
    @Query("SELECT COUNT(p) FROM Property p WHERE p.owner.keycloakId = :ownerKeycloakId AND p.organizationId = :orgId")
    long countByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête pour les IDs seulement (pour les vérifications d'existence)
     */
    @Query("SELECT p.id FROM Property p WHERE p.owner.keycloakId = :ownerKeycloakId AND p.organizationId = :orgId")
    List<Long> findIdsByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête optimisée avec FETCH JOIN pour charger la propriété avec son owner
     * Évite les LazyInitializationException
     */
    @Query("SELECT p FROM Property p LEFT JOIN FETCH p.owner WHERE p.id = :id AND p.organizationId = :orgId")
    java.util.Optional<Property> findByIdWithOwner(@Param("id") Long id, @Param("orgId") Long orgId);
}


