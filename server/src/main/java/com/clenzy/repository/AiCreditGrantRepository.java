package com.clenzy.repository;

import com.clenzy.model.AiCreditGrant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AiCreditGrantRepository extends JpaRepository<AiCreditGrant, Long> {

    /**
     * Poches actives verrouillees (PESSIMISTIC_WRITE) dans l'ordre de
     * consommation : SUBSCRIPTION d'abord, puis expiration croissante (FIFO).
     * Le verrou serialise les applications de consommation concurrentes
     * (plusieurs runs du meme tenant, plusieurs instances applicatives).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select g from AiCreditGrant g
            where g.organizationId = :orgId
              and g.expiresAt > :now
              and g.millicreditsConsumed < g.millicreditsGranted
            order by case when g.source = 'SUBSCRIPTION' then 0 else 1 end, g.expiresAt asc
            """)
    List<AiCreditGrant> lockActiveGrants(@Param("orgId") Long orgId, @Param("now") Instant now);

    /** Solde disponible (verite froide — recharge le compteur Redis). */
    @Query("""
            select coalesce(sum(g.millicreditsGranted - g.millicreditsConsumed), 0)
            from AiCreditGrant g
            where g.organizationId = :orgId and g.expiresAt > :now
            """)
    long availableMillicredits(@Param("orgId") Long orgId, @Param("now") Instant now);
}
