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
}
