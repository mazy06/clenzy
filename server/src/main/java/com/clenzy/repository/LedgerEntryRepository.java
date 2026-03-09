package com.clenzy.repository;

import com.clenzy.model.LedgerEntry;
import com.clenzy.model.LedgerReferenceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {

    Page<LedgerEntry> findByWalletIdOrderByCreatedAtDesc(Long walletId, Pageable pageable);

    List<LedgerEntry> findByReferenceTypeAndReferenceId(
        LedgerReferenceType referenceType, String referenceId);

    @Query("SELECT COALESCE(" +
           "SUM(CASE WHEN e.entryType = com.clenzy.model.LedgerEntryType.CREDIT THEN e.amount ELSE java.math.BigDecimal.ZERO END) - " +
           "SUM(CASE WHEN e.entryType = com.clenzy.model.LedgerEntryType.DEBIT THEN e.amount ELSE java.math.BigDecimal.ZERO END), 0) " +
           "FROM LedgerEntry e WHERE e.walletId = :walletId")
    BigDecimal calculateBalance(@Param("walletId") Long walletId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e " +
           "WHERE e.entryType = com.clenzy.model.LedgerEntryType.CREDIT AND e.walletId = :walletId")
    BigDecimal sumCredits(@Param("walletId") Long walletId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e " +
           "WHERE e.entryType = com.clenzy.model.LedgerEntryType.DEBIT AND e.walletId = :walletId")
    BigDecimal sumDebits(@Param("walletId") Long walletId);

    List<LedgerEntry> findByOrganizationIdAndReferenceTypeAndReferenceId(
        Long organizationId, LedgerReferenceType referenceType, String referenceId);
}
