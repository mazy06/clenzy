package com.clenzy.repository;

import com.clenzy.model.AiUsageLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiUsageLedgerRepository extends JpaRepository<AiUsageLedgerEntry, Long> {

    boolean existsByIdempotencyKey(String idempotencyKey);
}
