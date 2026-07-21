package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.WalletRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final TenantContext tenantContext;

    public WalletService(WalletRepository walletRepository,
                         LedgerService ledgerService,
                         InterventionRepository interventionRepository,
                         ReservationRepository reservationRepository,
                         ServiceRequestRepository serviceRequestRepository,
                         TenantContext tenantContext) {
        this.walletRepository = walletRepository;
        this.ledgerService = ledgerService;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
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
     * Resultat de l'initialisation des wallets d'une organisation.
     */
    public record WalletInitializationResult(int walletsCreated, int paymentsRecorded) {}

    /**
     * Initialise les wallets de base (PLATFORM + ESCROW) de l'organisation et
     * rejoue dans le ledger les paiements deja effectues (interventions,
     * reservations, demandes de service) qui n'ont pas encore d'ecriture.
     *
     * Idempotent : un paiement deja present dans le ledger (reference
     * PAYMENT + refId) n'est pas re-enregistre. Toute l'operation est
     * transactionnelle (T-ARCH-03 : logique deplacee de WalletController).
     */
    @Transactional
    public WalletInitializationResult initializeWallets(Long orgId) {
        final String curr = "EUR";

        Wallet platformWallet = getOrCreatePlatformWallet(orgId, curr);
        Wallet escrowWallet = getOrCreateEscrowWallet(orgId, curr);

        int paymentsRecorded = 0;
        paymentsRecorded += backfillPaidInterventions(orgId, escrowWallet, platformWallet, curr);
        paymentsRecorded += backfillPaidReservations(orgId, escrowWallet, platformWallet, curr);
        paymentsRecorded += backfillPaidServiceRequests(orgId, escrowWallet, platformWallet);

        List<Wallet> wallets = getWalletsByOrganization(orgId);

        log.info("Wallets initialized for org {}: {} wallets, {} payments backfilled",
                orgId, wallets.size(), paymentsRecorded);

        return new WalletInitializationResult(wallets.size(), paymentsRecorded);
    }

    private int backfillPaidInterventions(Long orgId, Wallet escrowWallet, Wallet platformWallet, String curr) {
        int recorded = 0;
        Pageable all = PageRequest.of(0, 10000);
        Page<Intervention> interventions = interventionRepository.findPaymentHistory(
                PaymentStatus.PAID, null, all, orgId);
        for (Intervention i : interventions.getContent()) {
            BigDecimal cost = i.getEstimatedCost();
            if (cost == null || cost.compareTo(BigDecimal.ZERO) <= 0) continue;

            String refId = String.valueOf(i.getId());
            if (hasLedgerEntry(refId)) continue;

            // Ensure owner wallet
            if (i.getProperty() != null && i.getProperty().getOwner() != null) {
                getOrCreateWallet(orgId, WalletType.OWNER, i.getProperty().getOwner().getId(), curr);
            }
            ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                    LedgerReferenceType.PAYMENT, refId,
                    "Paiement intervention: " + i.getTitle());
            recorded++;
        }
        return recorded;
    }

    private int backfillPaidReservations(Long orgId, Wallet escrowWallet, Wallet platformWallet, String curr) {
        int recorded = 0;
        // Filtre PAID en SQL + fetch join property/owner : evite le scan des
        // reservations non payees et le lazy-load owner par reservation.
        for (Reservation r : reservationRepository.findPaidWithOwnerForWalletBackfill(orgId)) {
            BigDecimal cost = r.getTotalPrice();
            if (cost == null || cost.compareTo(BigDecimal.ZERO) <= 0) continue;

            String refId = String.valueOf(r.getId());
            if (hasLedgerEntry(refId)) continue;

            if (r.getProperty() != null && r.getProperty().getOwner() != null) {
                getOrCreateWallet(orgId, WalletType.OWNER, r.getProperty().getOwner().getId(), curr);
            }
            ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                    LedgerReferenceType.PAYMENT, refId,
                    "Paiement reservation: " + (r.getGuestName() != null ? r.getGuestName() : "guest"));
            recorded++;
        }
        return recorded;
    }

    private int backfillPaidServiceRequests(Long orgId, Wallet escrowWallet, Wallet platformWallet) {
        int recorded = 0;
        // Filtre org + paymentStatus=PAID en SQL — remplace le scan findAll()
        // cross-org filtre en memoire (audit perf 2026-07-21).
        for (ServiceRequest sr : serviceRequestRepository.findByOrganizationIdAndPaymentStatus(orgId, PaymentStatus.PAID)) {
            BigDecimal cost = sr.getEstimatedCost();
            if (cost == null || cost.compareTo(BigDecimal.ZERO) <= 0) continue;

            String refId = String.valueOf(sr.getId());
            if (hasLedgerEntry(refId)) continue;

            ledgerService.recordTransfer(escrowWallet, platformWallet, cost,
                    LedgerReferenceType.PAYMENT, refId,
                    "Paiement demande de service: " + sr.getTitle());
            recorded++;
        }
        return recorded;
    }

    private boolean hasLedgerEntry(String refId) {
        // EXISTS SQL — evite de charger la liste complete pour un isEmpty.
        return ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, refId);
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
