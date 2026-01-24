package com.clenzy.repository;

import com.clenzy.model.Team;
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
public interface TeamRepository extends JpaRepository<Team, Long> {
    
    /**
     * Requêtes optimisées avec FETCH JOIN et cache
     */
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.interventionType = :interventionType")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByInterventionType(@Param("interventionType") String interventionType);
    
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.name LIKE %:name%")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByNameContaining(@Param("name") String name);
    
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE tm.user.id = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByUserId(@Param("userId") Long userId);
    
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE tm.user.keycloakId = :userKeycloakId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Team> findAllWithMembers(Pageable pageable);
    
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.interventionType = :interventionType")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Team> findByInterventionTypeWithMembers(@Param("interventionType") String interventionType, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(t) FROM Team t")
    long countTeams();
    
    @Query("SELECT COUNT(t) FROM Team t WHERE t.interventionType = :interventionType")
    long countByInterventionType(@Param("interventionType") String interventionType);
    
    @Query("SELECT COUNT(t) FROM Team t JOIN t.members tm WHERE tm.user.keycloakId = :userKeycloakId")
    long countByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT t.id FROM Team t WHERE t.interventionType = :interventionType")
    List<Long> findIdsByInterventionType(@Param("interventionType") String interventionType);
}


