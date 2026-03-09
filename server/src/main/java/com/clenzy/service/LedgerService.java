package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Immutable double-entry ledger service.
 * Every transfer creates exactly 2 entries (debit + credit) atomically.
 * Entries are never updated or deleted.
 */
@Service
@Transactional
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);

    private final LedgerEntryRepository ledgerEntryRepository;

    public LedgerService(LedgerEntryRepository ledgerEntryRepository) {
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    /**
     * Records a double-entry transfer. Creates exactly 2 LedgerEntry rows
     * in the same transaction. Returns the pair [debit, credit].
     *
     * @param from        source wallet (debited)
     * @param to          destination wallet (credited)
     * @param amount      transfer amount (must be positive)
     * @param refType     reference type (PAYMENT, ESCROW_HOLD, SPLIT, etc.)
     * @param refId       reference identifier (transaction ref, escrow ID, etc.)
     * @param description human-readable description
     * @return array of [debitEntry, creditEntry]
     */
    public LedgerEntry[] recordTransfer(Wallet from, Wallet to, BigDecimal amount,
                                         LedgerReferenceType refType, String refId,
                                         String description) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Transfer amount must be positive: " + amount);
        }

        BigDecimal fromBalance = calculateBalance(from.getId());
        BigDecimal toBalance = calculateBalance(to.getId());

        // Create DEBIT entry (source wallet)
        LedgerEntry debit = new LedgerEntry();
        debit.setOrganizationId(from.getOrganizationId());
        debit.setWalletId(from.getId());
        debit.setEntryType(LedgerEntryType.DEBIT);
        debit.setAmount(amount);
        debit.setCurrency(from.getCurrency());
        debit.setBalanceAfter(fromBalance.subtract(amount));
        debit.setReferenceType(refType);
        debit.setReferenceId(refId);
        debit.setDescription(description);

        // Create CREDIT entry (destination wallet)
        LedgerEntry credit = new LedgerEntry();
        credit.setOrganizationId(to.getOrganizationId());
        credit.setWalletId(to.getId());
        credit.setEntryType(LedgerEntryType.CREDIT);
        credit.setAmount(amount);
        credit.setCurrency(to.getCurrency());
        credit.setBalanceAfter(toBalance.add(amount));
        credit.setReferenceType(refType);
        credit.setReferenceId(refId);
        credit.setDescription(description);

        // Save both
        debit = ledgerEntryRepository.save(debit);
        credit = ledgerEntryRepository.save(credit);

        // Link counterparts
        debit.setCounterpartEntryId(credit.getId());
        credit.setCounterpartEntryId(debit.getId());
        ledgerEntryRepository.save(debit);
        ledgerEntryRepository.save(credit);

        log.info("Ledger transfer: {} {} from wallet {} to wallet {} [ref: {} {}]",
            amount, from.getCurrency(), from.getId(), to.getId(), refType, refId);

        return new LedgerEntry[]{debit, credit};
    }

    /**
     * Calculate wallet balance from ledger entries.
     * Balance = SUM(credits) - SUM(debits)
     */
    @Transactional(readOnly = true)
    public BigDecimal calculateBalance(Long walletId) {
        BigDecimal balance = ledgerEntryRepository.calculateBalance(walletId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    /**
     * Get paginated ledger entries for a wallet.
     */
    @Transactional(readOnly = true)
    public Page<LedgerEntry> getEntries(Long walletId, Pageable pageable) {
        return ledgerEntryRepository.findByWalletIdOrderByCreatedAtDesc(walletId, pageable);
    }

    /**
     * Get entries by reference.
     */
    @Transactional(readOnly = true)
    public List<LedgerEntry> getEntriesByReference(LedgerReferenceType refType, String refId) {
        return ledgerEntryRepository.findByReferenceTypeAndReferenceId(refType, refId);
    }
}
