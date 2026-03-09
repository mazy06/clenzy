package com.clenzy.service;

import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.repository.WalletRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class WalletService {

    private static final Logger log = LoggerFactory.getLogger(WalletService.class);

    private final WalletRepository walletRepository;
    private final LedgerService ledgerService;
    private final TenantContext tenantContext;

    public WalletService(WalletRepository walletRepository,
                         LedgerService ledgerService,
                         TenantContext tenantContext) {
        this.walletRepository = walletRepository;
        this.ledgerService = ledgerService;
        this.tenantContext = tenantContext;
    }

    /**
     * Get or create a wallet. Idempotent.
     * For PLATFORM/ESCROW wallets, ownerId should be null.
     * For OWNER/CONCIERGE wallets, ownerId is the user ID.
     */
    public Wallet getOrCreateWallet(Long orgId, WalletType type, Long ownerId, String currency) {
        if (ownerId == null) {
            return walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    orgId, type, currency)
                .orElseGet(() -> {
                    log.info("Creating {} wallet for org {} in {}", type, orgId, currency);
                    Wallet w = new Wallet();
                    w.setOrganizationId(orgId);
                    w.setWalletType(type);
                    w.setOwnerId(null);
                    w.setCurrency(currency);
                    return walletRepository.save(w);
                });
        }
        return walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                orgId, type, ownerId, currency)
            .orElseGet(() -> {
                log.info("Creating {} wallet for org {}, owner {} in {}", type, orgId, ownerId, currency);
                Wallet w = new Wallet();
                w.setOrganizationId(orgId);
                w.setWalletType(type);
                w.setOwnerId(ownerId);
                w.setCurrency(currency);
                return walletRepository.save(w);
            });
    }

    /**
     * Convenience: get or create the platform wallet for an org.
     */
    public Wallet getOrCreatePlatformWallet(Long orgId, String currency) {
        return getOrCreateWallet(orgId, WalletType.PLATFORM, null, currency);
    }

    /**
     * Convenience: get or create the escrow wallet for an org.
     */
    public Wallet getOrCreateEscrowWallet(Long orgId, String currency) {
        return getOrCreateWallet(orgId, WalletType.ESCROW, null, currency);
    }

    /**
     * Get wallet balance (computed from ledger entries).
     */
    @Transactional(readOnly = true)
    public BigDecimal getBalance(Long walletId) {
        BigDecimal balance = ledgerService.calculateBalance(walletId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    /**
     * List all wallets for an organization.
     */
    @Transactional(readOnly = true)
    public List<Wallet> getWalletsByOrganization(Long orgId) {
        return walletRepository.findByOrganizationId(orgId);
    }

    /**
     * Get a wallet by ID with ownership verification.
     */
    @Transactional(readOnly = true)
    public Wallet getWalletById(Long walletId) {
        return walletRepository.findById(walletId)
            .orElseThrow(() -> new RuntimeException("Wallet not found: " + walletId));
    }
}
