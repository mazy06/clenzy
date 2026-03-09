package com.clenzy.controller;

import com.clenzy.dto.LedgerEntryDto;
import com.clenzy.dto.WalletDto;
import com.clenzy.model.LedgerEntry;
import com.clenzy.model.Wallet;
import com.clenzy.service.LedgerService;
import com.clenzy.service.WalletService;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/wallets")
@PreAuthorize("isAuthenticated()")
public class WalletController {

    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final TenantContext tenantContext;

    public WalletController(WalletService walletService,
                            LedgerService ledgerService,
                            TenantContext tenantContext) {
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<WalletDto>> listWallets() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<Wallet> wallets = walletService.getWalletsByOrganization(orgId);
        List<WalletDto> dtos = wallets.stream()
            .map(w -> toDto(w, walletService.getBalance(w.getId())))
            .toList();
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}/balance")
    public ResponseEntity<WalletDto> getBalance(@PathVariable Long id) {
        Wallet wallet = walletService.getWalletById(id);
        verifyOwnership(wallet);
        BigDecimal balance = walletService.getBalance(id);
        return ResponseEntity.ok(toDto(wallet, balance));
    }

    @GetMapping("/{id}/entries")
    public ResponseEntity<Page<LedgerEntryDto>> getEntries(
            @PathVariable Long id, Pageable pageable) {
        Wallet wallet = walletService.getWalletById(id);
        verifyOwnership(wallet);
        Page<LedgerEntryDto> entries = ledgerService.getEntries(id, pageable)
            .map(this::toEntryDto);
        return ResponseEntity.ok(entries);
    }

    private void verifyOwnership(Wallet wallet) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (!wallet.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Access denied: wallet does not belong to organization");
        }
    }

    private WalletDto toDto(Wallet w, BigDecimal balance) {
        return new WalletDto(
            w.getId(),
            w.getWalletType().name(),
            w.getOwnerId(),
            w.getCurrency(),
            balance
        );
    }

    private LedgerEntryDto toEntryDto(LedgerEntry e) {
        return new LedgerEntryDto(
            e.getId(),
            e.getEntryType().name(),
            e.getAmount(),
            e.getCurrency(),
            e.getBalanceAfter(),
            e.getReferenceType().name(),
            e.getReferenceId(),
            e.getDescription(),
            e.getCreatedAt()
        );
    }
}
