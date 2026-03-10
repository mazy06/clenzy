package com.clenzy.controller;

import com.clenzy.dto.LedgerEntryDto;
import com.clenzy.dto.WalletDto;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.LedgerService;
import com.clenzy.service.WalletService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wallets")
@PreAuthorize("isAuthenticated()")
public class WalletController {

    private static final Logger log = LoggerFactory.getLogger(WalletController.class);

    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final TenantContext tenantContext;

    public WalletController(WalletService walletService,
                            LedgerService ledgerService,
                            InterventionRepository interventionRepository,
                            ReservationRepository reservationRepository,
                            ServiceRequestRepository serviceRequestRepository,
                            TenantContext tenantContext) {
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
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

    /**
     * Initialize wallets for the current organization and backfill ledger entries
     * for existing paid payments that don't have ledger records yet.
     */
    @PostMapping("/initialize")
    @PreAuthorize("hasAnyAuthority('payments:manage', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> initializeWallets() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String curr = "EUR";

        // Ensure base wallets exist
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, curr);
        Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, curr);

        int paymentsRecorded = 0;

        // Backfill from paid interventions
        Pageable all = PageRequest.of(0, 10000);
        Page<Intervention> interventions = interventionRepository.findPaymentHistory(
                PaymentStatus.PAID, null, all, orgId);
        for (Intervention i : interventions.getContent()) {
            BigDecimal cost = i.getEstimatedCost();
            if (cost != null && cost.compareTo(BigDecimal.ZERO) > 0) {
                String refId = String.valueOf(i.getId());
                List<LedgerEntry> existing = ledgerService.getEntriesByReference(
                        LedgerReferenceType.PAYMENT, refId);
                if (existing.isEmpty()) {
                    // Ensure owner wallet
                    if (i.getProperty() != null && i.getProperty().getOwner() != null) {
                        walletService.getOrCreateWallet(orgId, WalletType.OWNER,
                                i.getProperty().getOwner().getId(), curr);
                    }
                    ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                            LedgerReferenceType.PAYMENT, refId,
                            "Paiement intervention: " + i.getTitle());
                    paymentsRecorded++;
                }
            }
        }

        // Backfill from paid reservations
        List<Reservation> reservations = reservationRepository.findAllWithPayment(orgId);
        for (Reservation r : reservations) {
            if (r.getPaymentStatus() == PaymentStatus.PAID) {
                BigDecimal cost = r.getTotalPrice();
                if (cost != null && cost.compareTo(BigDecimal.ZERO) > 0) {
                    String refId = String.valueOf(r.getId());
                    List<LedgerEntry> existing = ledgerService.getEntriesByReference(
                            LedgerReferenceType.PAYMENT, refId);
                    if (existing.isEmpty()) {
                        if (r.getProperty() != null && r.getProperty().getOwner() != null) {
                            walletService.getOrCreateWallet(orgId, WalletType.OWNER,
                                    r.getProperty().getOwner().getId(), curr);
                        }
                        ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                                LedgerReferenceType.PAYMENT, refId,
                                "Paiement reservation: " + (r.getGuestName() != null ? r.getGuestName() : "guest"));
                        paymentsRecorded++;
                    }
                }
            }
        }

        // Backfill from paid service requests
        List<ServiceRequest> serviceRequests = serviceRequestRepository.findAllAwaitingPayment(orgId);
        // Also look for already-paid SRs
        Pageable allSr = PageRequest.of(0, 10000);
        // Use a query that gets paid SRs
        for (ServiceRequest sr : serviceRequestRepository.findAll()) {
            if (sr.getOrganizationId() != null && sr.getOrganizationId().equals(orgId)
                    && sr.getPaymentStatus() == PaymentStatus.PAID) {
                BigDecimal cost = sr.getEstimatedCost();
                if (cost != null && cost.compareTo(BigDecimal.ZERO) > 0) {
                    String refId = String.valueOf(sr.getId());
                    List<LedgerEntry> existing = ledgerService.getEntriesByReference(
                            LedgerReferenceType.PAYMENT, refId);
                    if (existing.isEmpty()) {
                        ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                                LedgerReferenceType.PAYMENT, refId,
                                "Paiement demande de service: " + sr.getTitle());
                        paymentsRecorded++;
                    }
                }
            }
        }

        List<Wallet> wallets = walletService.getWalletsByOrganization(orgId);

        log.info("Wallets initialized for org {}: {} wallets, {} payments backfilled",
                orgId, wallets.size(), paymentsRecorded);

        return ResponseEntity.ok(Map.of(
                "walletsCreated", wallets.size(),
                "paymentsRecorded", paymentsRecorded
        ));
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
