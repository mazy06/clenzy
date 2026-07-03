package com.clenzy.repository;

import com.clenzy.model.AgentPendingAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AgentPendingActionRepository extends JpaRepository<AgentPendingAction, String> {

    /** Actions en attente d'un user (fallback d'affichage si l'index Redis est perdu). */
    List<AgentPendingAction> findByKeycloakUserIdAndStatusAndExpiresAtAfterOrderByCreatedAtAsc(
            String keycloakUserId, String status, Instant now);

    /** Expiration en masse (scheduler X1) — l'outcome EXPIRED nourrit les Regles de Confiance. */
    @Modifying
    @Query("""
            update AgentPendingAction a
            set a.status = 'EXPIRED', a.resolvedAt = :now
            where a.status = 'PENDING' and a.expiresAt <= :now
            """)
    int expireOverdue(@Param("now") Instant now);

    /**
     * Candidats aux Regles de Confiance (X2) : couples (org, outil) ayant au
     * moins {@code threshold} confirmations. Le filtrage fin (les N DERNIERES
     * resolutions toutes CONFIRMED, sans refus ni expiration) est fait ensuite
     * par le service sur la fenetre recente.
     */
    @Query("""
            select a.organizationId, a.toolName
            from AgentPendingAction a
            where a.status = 'CONFIRMED'
            group by a.organizationId, a.toolName
            having count(a) >= :threshold
            """)
    List<Object[]> findTrustRuleCandidates(@Param("threshold") long threshold);

    /** Dernieres resolutions (hors PENDING) d'un couple (org, outil), recentes d'abord. */
    List<AgentPendingAction> findByOrganizationIdAndToolNameAndStatusNotOrderByResolvedAtDesc(
            Long organizationId, String toolName, String status,
            org.springframework.data.domain.Pageable pageable);
}
