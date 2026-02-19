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
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.interventionType = :interventionType AND t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByInterventionType(@Param("interventionType") String interventionType, @Param("orgId") Long orgId);

    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.name LIKE %:name% AND t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByNameContaining(@Param("name") String name, @Param("orgId") Long orgId);

    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE tm.user.id = :userId AND t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByUserId(@Param("userId") Long userId, @Param("orgId") Long orgId);

    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE tm.user.keycloakId = :userKeycloakId AND t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Team> findByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Team> findAllWithMembers(Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.interventionType = :interventionType AND t.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Team> findByInterventionTypeWithMembers(@Param("interventionType") String interventionType, Pageable pageable, @Param("orgId") Long orgId);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(t) FROM Team t WHERE t.organizationId = :orgId")
    long countTeams(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(t) FROM Team t WHERE t.interventionType = :interventionType AND t.organizationId = :orgId")
    long countByInterventionType(@Param("interventionType") String interventionType, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(t) FROM Team t JOIN t.members tm WHERE tm.user.keycloakId = :userKeycloakId AND t.organizationId = :orgId")
    long countByUserKeycloakId(@Param("userKeycloakId") String userKeycloakId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT t.id FROM Team t WHERE t.interventionType = :interventionType AND t.organizationId = :orgId")
    List<Long> findIdsByInterventionType(@Param("interventionType") String interventionType, @Param("orgId") Long orgId);
}
