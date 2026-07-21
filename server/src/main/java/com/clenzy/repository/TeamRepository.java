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
import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {

    /**
     * Id + nom des équipes de l'org (Rapports Baitly) — projection légère,
     * sans fetch des membres. Lignes {@code [Long id, String name]}.
     */
    @Query("SELECT t.id, t.name FROM Team t WHERE t.organizationId = :orgId ORDER BY t.name")
    List<Object[]> findIdAndNameForReport(@Param("orgId") Long orgId);

    /**
     * Fetch a team by ID with members and their users eagerly loaded.
     */
    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.members tm LEFT JOIN FETCH tm.user WHERE t.id = :id")
    Optional<Team> findByIdWithMembers(@Param("id") Long id);

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

    /**
     * Compteur d'équipes pour les rapports PDF — org optionnelle ({@code null}
     * = platform staff cross-org). Remplace findAll().size() (audit perf 2026-07-21).
     */
    @Query("SELECT COUNT(t) FROM Team t WHERE (:orgId IS NULL OR t.organizationId = :orgId)")
    long countAllForPdfReport(@Param("orgId") Long orgId);

    /**
     * Nombre total de membres d'équipe — org optionnelle. Remplace le lazy-load
     * {@code getMembers().size()} par équipe (audit perf 2026-07-21).
     */
    @Query("SELECT COUNT(tm) FROM Team t JOIN t.members tm WHERE (:orgId IS NULL OR t.organizationId = :orgId)")
    long countMembersForPdfReport(@Param("orgId") Long orgId);

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
