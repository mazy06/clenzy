package com.clenzy.service;

import com.clenzy.dto.SplitRatios;
import com.clenzy.dto.SplitResult;
import com.clenzy.model.*;
import com.clenzy.repository.LedgerEntryRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SplitConfigurationRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

@Service
@Transactional
public class SplitPaymentService {

    /**
     * Scission historique de la commission de contrat, conservee uniquement
     * comme repli quand la repartition de l'organisation ne preleve rien.
     */
    private static final BigDecimal LEGACY_PLATFORM_CUT = new BigDecimal("0.25");

    private static final Logger log = LoggerFactory.getLogger(SplitPaymentService.class);

    private final SplitConfigurationRepository splitConfigRepository;
    private final ManagementContractService managementContractService;
    private final ReservationRepository reservationRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final TenantContext tenantContext;

    public SplitPaymentService(SplitConfigurationRepository splitConfigRepository,
                                ManagementContractService managementContractService,
                                ReservationRepository reservationRepository,
                                WalletService walletService,
                                LedgerService ledgerService,
                                LedgerEntryRepository ledgerEntryRepository,
                                TenantContext tenantContext) {
        this.splitConfigRepository = splitConfigRepository;
        this.managementContractService = managementContractService;
        this.reservationRepository = reservationRepository;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.tenantContext = tenantContext;
    }

    /** Reference stable des ecritures de split d'une reservation (cle d'idempotence). */
    static String splitReference(Long reservationId) {
        return "SPLIT-RES-" + reservationId;
    }

    /**
     * Splits released escrow funds according to the split ratios.
     *
     * Resolution priority for commission/split ratios:
     *   1. ManagementContract.commissionRate (per property/owner — most specific)
     *   2. SplitConfiguration (per organization — configurable by SUPER_ADMIN)
     *   3. System defaults (owner: 80%, platform: 5%, concierge: 15%)
     *
     * @param reservationId  the reservation being split
     * @param totalAmount    total amount to split
     * @param currency       currency code
     * @param ownerId        property owner user ID
     * @return split result with amounts per participant
     */
    public SplitResult splitPayment(Long reservationId, BigDecimal totalAmount,
                                     String currency, Long ownerId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Idempotence (audit 2026-07, P5-05) : ESCROW_RELEASED arrive par Kafka, donc
        // at-least-once. Le statut de l'EscrowHold ne peut pas servir de garde — il est
        // deja RELEASED quand l'evenement est publie (EscrowService#releaseFunds). Le
        // ledger, lui, porte une reference stable : sa presence prouve que le split a
        // deja ete applique. Sans cette garde, un rejeu — y compris un simple redemarrage
        // ou un timeout de broker — recrediterait le wallet du proprietaire.
        final String splitRef = splitReference(reservationId);
        if (ledgerEntryRepository.existsByReferenceTypeAndReferenceId(
                LedgerReferenceType.SPLIT, splitRef)) {
            log.warn("Split deja applique pour la reservation {} (ref {}) — rejeu ignore",
                reservationId, splitRef);
            return new SplitResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                totalAmount, null, null);
        }

        log.info("Splitting {} {} for reservation {} (org {}, owner {})",
            totalAmount, currency, reservationId, orgId, ownerId);

        // 1. Resolve split ratios (ManagementContract → SplitConfig → defaults)
        SplitRatios ratios = resolveSplitRatios(orgId, reservationId);

        // 2. Calculate amounts
        BigDecimal ownerAmount = totalAmount.multiply(ratios.ownerShare())
            .setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformAmount = totalAmount.multiply(ratios.platformShare())
            .setScale(2, RoundingMode.HALF_UP);
        // Concierge gets the remainder to avoid rounding issues
        BigDecimal conciergeAmount = totalAmount.subtract(ownerAmount).subtract(platformAmount);

        // 3. Get or create wallets
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
        Wallet ownerWallet = walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, currency);
        Wallet conciergeWallet = walletService.getOrCreateWallet(orgId, WalletType.CONCIERGE, null, currency);

        // 4. Record ledger transfers
        // splitRef : calcule en tete de methode, il sert aussi de cle d'idempotence.

        // Owner share: platform -> owner
        if (ownerAmount.compareTo(BigDecimal.ZERO) > 0) {
            ledgerService.recordTransfer(platformWallet, ownerWallet, ownerAmount,
                LedgerReferenceType.SPLIT, splitRef,
                "Owner share (" + ratios.ownerShare().multiply(BigDecimal.valueOf(100)).stripTrailingZeros() + "%) for reservation #" + reservationId);
        }

        // Concierge share: platform -> concierge
        if (conciergeAmount.compareTo(BigDecimal.ZERO) > 0) {
            ledgerService.recordTransfer(platformWallet, conciergeWallet, conciergeAmount,
                LedgerReferenceType.SPLIT, splitRef,
                "Concierge share (" + ratios.conciergeShare().multiply(BigDecimal.valueOf(100)).stripTrailingZeros() + "%) for reservation #" + reservationId);
        }

        // Platform keeps its share (no transfer needed - already in platform wallet)
        log.info("Split completed: owner={} platform={} concierge={} (ratios: {}/{}/{}) for reservation {}",
            ownerAmount, platformAmount, conciergeAmount,
            ratios.ownerShare(), ratios.platformShare(), ratios.conciergeShare(),
            reservationId);

        return new SplitResult(ownerAmount, platformAmount, conciergeAmount,
            totalAmount, ownerWallet.getId(), conciergeWallet.getId());
    }

    /**
     * Splits funds for non-reservation payments (interventions, service requests).
     * If a propertyId is provided, checks for ManagementContract to determine
     * whether a concierge is involved. If no concierge, the concierge share
     * is redirected to the owner.
     *
     * @param amount     total amount to split
     * @param currency   currency code
     * @param ownerId    property owner user ID (nullable)
     * @param propertyId property ID (nullable — used to detect concierge)
     * @param refType    reference type for logging (e.g. "intervention", "service-request")
     * @param refId      reference ID (e.g. "42")
     * @return split result with amounts per participant
     */
    public SplitResult splitGenericPayment(BigDecimal amount, String currency,
                                            Long ownerId, Long propertyId,
                                            String refType, String refId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Splitting {} {} for {} {} (org {}, owner {}, property {})",
            amount, currency, refType, refId, orgId, ownerId, propertyId);

        // Resolve ratios: check ManagementContract if property is known
        SplitRatios ratios = resolveSplitRatiosForProperty(orgId, propertyId);

        // Calculate amounts
        BigDecimal ownerAmount = amount.multiply(ratios.ownerShare())
            .setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformAmount = amount.multiply(ratios.platformShare())
            .setScale(2, RoundingMode.HALF_UP);
        BigDecimal conciergeAmount = amount.subtract(ownerAmount).subtract(platformAmount);

        // Get or create wallets
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
        Wallet ownerWallet = (ownerId != null)
            ? walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, currency)
            : null;
        Wallet conciergeWallet = walletService.getOrCreateWallet(orgId, WalletType.CONCIERGE, null, currency);

        // Record ledger transfers
        String splitRef = "SPLIT-" + refType.toUpperCase().replace("-", "") + "-" + refId;

        // Owner share: platform -> owner
        if (ownerAmount.compareTo(BigDecimal.ZERO) > 0 && ownerWallet != null) {
            ledgerService.recordTransfer(platformWallet, ownerWallet, ownerAmount,
                LedgerReferenceType.SPLIT, splitRef,
                "Owner share (" + ratios.ownerShare().multiply(BigDecimal.valueOf(100)).stripTrailingZeros()
                    + "%) for " + refType + " #" + refId);
        }

        // Concierge share: platform -> concierge
        if (conciergeAmount.compareTo(BigDecimal.ZERO) > 0) {
            ledgerService.recordTransfer(platformWallet, conciergeWallet, conciergeAmount,
                LedgerReferenceType.SPLIT, splitRef,
                "Concierge share (" + ratios.conciergeShare().multiply(BigDecimal.valueOf(100)).stripTrailingZeros()
                    + "%) for " + refType + " #" + refId);
        }

        log.info("Split completed: owner={} platform={} concierge={} (ratios: {}/{}/{}) for {} {}",
            ownerAmount, platformAmount, conciergeAmount,
            ratios.ownerShare(), ratios.platformShare(), ratios.conciergeShare(),
            refType, refId);

        Long ownerWalletId = (ownerWallet != null) ? ownerWallet.getId() : null;
        return new SplitResult(ownerAmount, platformAmount, conciergeAmount,
            amount, ownerWalletId, conciergeWallet.getId());
    }

    /**
     * Resolve split ratios with full priority chain.
     * Used when a reservationId is available to look up the property's ManagementContract.
     *
     * Priority:
     *   1. ManagementContract.commissionRate for the reservation's property (3-way split spécifique)
     *   2. SplitConfiguration for the organization (Paramètres → Paiement → Répartition des revenus)
     *   3. System defaults (SplitRatios.DEFAULT)
     *
     * KEY RULE: Si aucun contrat de gestion n'existe pour la propriété, on utilise la
     * répartition par défaut de l'organisation telle que configurée par le SUPER_ADMIN
     * (peut être 3 parts si la part conciergerie est non nulle).
     */
    public SplitRatios resolveSplitRatios(Long orgId, Long reservationId) {
        if (reservationId != null) {
            try {
                Optional<Reservation> reservationOpt = reservationRepository.findById(reservationId);
                if (reservationOpt.isPresent()) {
                    Reservation reservation = reservationOpt.get();
                    if (reservation.getProperty() != null) {
                        Long propertyId = reservation.getProperty().getId();
                        Optional<ManagementContract> contractOpt =
                            managementContractService.getActiveContract(propertyId, orgId);

                        if (contractOpt.isPresent()) {
                            // ManagementContract found → 3-way split spécifique
                            ManagementContract contract = contractOpt.get();
                            BigDecimal commissionRate = contract.getCommissionRate();
                            if (commissionRate != null && commissionRate.compareTo(BigDecimal.ZERO) > 0) {
                                return contractRatios(orgId, commissionRate, propertyId);
                            }
                        } else {
                            // Pas de contrat → on utilise la répartition par défaut de l'org
                            // (configurable via Paramètres → Paiement → Répartition des revenus)
                            log.info("No ManagementContract for property {} — falling back to org default split", propertyId);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to resolve ManagementContract ratios for reservation {}: {}",
                    reservationId, e.getMessage());
            }
        }

        // Fallback to org-level SplitConfiguration (peut inclure une part conciergerie)
        return resolveSplitRatios(orgId);
    }

    /**
     * Resolve split ratios for a specific property (non-reservation context).
     * Si la propriété a un contrat de gestion actif, utilise sa commissionRate.
     * Sinon, retombe sur la répartition par défaut de l'organisation.
     *
     * @param orgId      organization ID
     * @param propertyId property ID (nullable — if null, uses org defaults)
     * @return split ratios résolus
     */
    public SplitRatios resolveSplitRatiosForProperty(Long orgId, Long propertyId) {
        if (propertyId != null) {
            try {
                Optional<ManagementContract> contractOpt =
                    managementContractService.getActiveContract(propertyId, orgId);

                if (contractOpt.isPresent()) {
                    ManagementContract contract = contractOpt.get();
                    BigDecimal commissionRate = contract.getCommissionRate();
                    if (commissionRate != null && commissionRate.compareTo(BigDecimal.ZERO) > 0) {
                        return contractRatios(orgId, commissionRate, propertyId);
                    }
                }

                // Pas de contrat → on utilise la répartition par défaut de l'org
                log.info("No ManagementContract for property {} — falling back to org default split", propertyId);
            } catch (Exception e) {
                log.warn("Failed to check ManagementContract for property {}: {}", propertyId, e.getMessage());
            }
        }

        // No property context OR no contract → use org defaults
        return resolveSplitRatios(orgId);
    }


    /**
     * Repartition d'un logement sous contrat de gestion.
     *
     * <p>Le contrat fixe ce qui est preleve au total ({@code commissionRate}) ;
     * la scission entre plateforme et conciergerie suit le <b>ratio configure par
     * l'organisation</b> (Parametres &gt; Paiement). Avant, elle etait figee a
     * 25/75 dans le code : l'ecran de repartition annoncait donc un partage que
     * le calcul ignorait des qu'un contrat existait.</p>
     *
     * <p>Si la configuration ne preleve rien (plateforme et conciergerie a zero),
     * aucun ratio ne peut en etre deduit alors que le contrat, lui, preleve : on
     * retombe sur l'ancien 25/75 plutot que de choisir un beneficiaire au
     * hasard, et on le signale.</p>
     */
    private SplitRatios contractRatios(Long orgId, BigDecimal commissionRate, Long propertyId) {
        SplitRatios orgRatios = resolveSplitRatios(orgId);
        BigDecimal platformWeight = orgRatios.platformShare() != null
            ? orgRatios.platformShare() : BigDecimal.ZERO;
        BigDecimal conciergeWeight = orgRatios.conciergeShare() != null
            ? orgRatios.conciergeShare() : BigDecimal.ZERO;
        BigDecimal weightTotal = platformWeight.add(conciergeWeight);

        BigDecimal platformShare;
        if (weightTotal.compareTo(BigDecimal.ZERO) <= 0) {
            platformShare = commissionRate.multiply(LEGACY_PLATFORM_CUT)
                .setScale(4, RoundingMode.HALF_UP);
            log.warn("Property {} : repartition org sans part plateforme ni conciergerie, "
                + "scission de la commission de contrat laissee a 25/75", propertyId);
        } else {
            platformShare = commissionRate.multiply(platformWeight)
                .divide(weightTotal, 4, RoundingMode.HALF_UP);
        }

        // Le solde plutot qu'un second produit : la somme des trois parts doit
        // retomber exactement sur 1, sans reliquat d'arrondi.
        BigDecimal conciergeShare = commissionRate.subtract(platformShare);
        BigDecimal ownerShare = BigDecimal.ONE.subtract(commissionRate);

        log.info("Property {} sous contrat — commission {} scindee plateforme={} conciergerie={} (proprietaire={})",
            propertyId, commissionRate, platformShare, conciergeShare, ownerShare);
        return new SplitRatios(ownerShare, platformShare, conciergeShare);
    }

    /**
     * Resolve split ratios for an organization (without reservation/property context).
     * Priority: SplitConfiguration (is_default) -> fallback defaults
     */
    public SplitRatios resolveSplitRatios(Long orgId) {
        // Check for org-level default split config
        Optional<SplitConfiguration> orgDefault =
            splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(orgId);

        if (orgDefault.isPresent()) {
            SplitConfiguration config = orgDefault.get();
            return new SplitRatios(
                config.getOwnerShare(),
                config.getPlatformShare(),
                config.getConciergeShare()
            );
        }

        // Fallback to system defaults
        return SplitRatios.DEFAULT;
    }
}
