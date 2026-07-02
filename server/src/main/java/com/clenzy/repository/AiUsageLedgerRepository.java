package com.clenzy.repository;

import com.clenzy.model.AiUsageLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiUsageLedgerRepository extends JpaRepository<AiUsageLedgerEntry, Long> {

    boolean existsByIdempotencyKey(String idempotencyKey);

    /** Dernieres lignes du ledger d'une org (ecran credits, T-08). */
    java.util.List<AiUsageLedgerEntry> findTop50ByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Cumul (valeur absolue) des debits d'un bucket d'autonomie depuis une date
     * (cycle courant) — sous-budget premium X4. Ne compte que les DEBIT
     * (millicredits negatifs) ; retourne un total positif.
     */
    @org.springframework.data.jpa.repository.Query("""
            select coalesce(-sum(e.millicredits), 0)
            from AiUsageLedgerEntry e
            where e.organizationId = :orgId
              and e.autonomyBucket = :bucket
              and e.entryType = 'DEBIT'
              and e.createdAt >= :since
            """)
    long sumBucketDebitSince(@org.springframework.data.repository.query.Param("orgId") Long orgId,
                             @org.springframework.data.repository.query.Param("bucket") String bucket,
                             @org.springframework.data.repository.query.Param("since") java.time.Instant since);
}
