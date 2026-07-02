package com.clenzy.repository;

import com.clenzy.model.AiUsageLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiUsageLedgerRepository extends JpaRepository<AiUsageLedgerEntry, Long> {

    boolean existsByIdempotencyKey(String idempotencyKey);

    /** Dernieres lignes du ledger d'une org (ecran credits, T-08). */
    java.util.List<AiUsageLedgerEntry> findTop50ByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
}
