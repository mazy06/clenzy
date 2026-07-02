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

    /** Idempotence des webhooks de dotation (T-07). */
    boolean existsByStripeRef(String stripeRef);

    /** Poches echues avec du restant a journaliser en EXPIRY (job quotidien T-07). */
    @Query("""
            select g from AiCreditGrant g
            where g.expiresAt <= :now
              and g.millicreditsConsumed < g.millicreditsGranted
            """)
    List<AiCreditGrant> findExpiredWithRemaining(@Param("now") Instant now);

    /** Poches actives d'une org (lecture solde detaille, sans verrou). */
    List<AiCreditGrant> findByOrganizationIdAndExpiresAtAfterOrderByExpiresAtAsc(
            Long organizationId, Instant now);

    /** Orgs ayant des poches actives (reconciliation du solde chaud, X10). */
    @Query("select distinct g.organizationId from AiCreditGrant g where g.expiresAt > :now")
    List<Long> findOrganizationsWithActiveGrants(@Param("now") Instant now);

    /** Total accorde par source sur une periode (controle du revenu, X10). */
    @Query("""
            select g.source, coalesce(sum(g.millicreditsGranted), 0), count(g)
            from AiCreditGrant g
            where g.grantedAt >= :from and g.grantedAt < :to
            group by g.source
            """)
    List<Object[]> sumGrantedBySource(@Param("from") Instant from, @Param("to") Instant to);
}
