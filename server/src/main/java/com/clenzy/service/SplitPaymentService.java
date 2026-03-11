package com.clenzy.service;

import com.clenzy.dto.SplitRatios;
import com.clenzy.dto.SplitResult;
import com.clenzy.model.*;
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

    private static final Logger log = LoggerFactory.getLogger(SplitPaymentService.class);

    private final SplitConfigurationRepository splitConfigRepository;
    private final ManagementContractService managementContractService;
    private final ReservationRepository reservationRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final TenantContext tenantContext;

    public SplitPaymentService(SplitConfigurationRepository splitConfigRepository,
                                ManagementContractService managementContractService,
                                ReservationRepository reservationRepository,
                                WalletService walletService,
                                LedgerService ledgerService,
                                TenantContext tenantContext) {
        this.splitConfigRepository = splitConfigRepository;
        this.managementContractService = managementContractService;
        this.reservationRepository = reservationRepository;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.tenantContext = tenantContext;
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
        String splitRef = "SPLIT-RES-" + reservationId;

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
     *   1. ManagementContract.commissionRate for the reservation's property
     *   2. SplitConfiguration for the organization (SUPER_ADMIN configurable)
     *   3. System defaults
     *
     * KEY RULE: If no ManagementContract exists for the property, there is no concierge
     * involved. In that case, the concierge share is redirected to the owner.
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
                            // ManagementContract found → 3-way split with concierge
                            ManagementContract contract = contractOpt.get();
                            BigDecimal commissionRate = contract.getCommissionRate();
                            if (commissionRate != null && commissionRate.compareTo(BigDecimal.ZERO) > 0) {
                                // commissionRate = total platform+concierge cut
                                // Split: platform gets 25% of commission, concierge gets 75%
                                BigDecimal ownerShare = BigDecimal.ONE.subtract(commissionRate);
                                BigDecimal platformShare = commissionRate.multiply(new BigDecimal("0.25"))
                                    .setScale(4, RoundingMode.HALF_UP);
                                BigDecimal conciergeShare = commissionRate.subtract(platformShare);

                                SplitRatios contractRatios = new SplitRatios(ownerShare, platformShare, conciergeShare);
                                log.info("Using ManagementContract commission {} for property {} (owner={}, platform={}, concierge={})",
                                    commissionRate, propertyId, ownerShare, platformShare, conciergeShare);
                                return contractRatios;
                            }
                        } else {
                            // No ManagementContract → owner manages directly, no concierge
                            log.info("No ManagementContract for property {} — 2-way split (no concierge)", propertyId);
                            return resolveNoConciergeRatios(orgId);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to resolve ManagementContract ratios for reservation {}: {}",
                    reservationId, e.getMessage());
            }
        }

        // Fallback to org-level SplitConfiguration (includes concierge by default)
        return resolveSplitRatios(orgId);
    }

    /**
     * Resolve split ratios for a specific property (non-reservation context).
     * Checks if the property has an active ManagementContract to determine
     * whether a concierge is involved.
     *
     * @param orgId      organization ID
     * @param propertyId property ID (nullable — if null, uses org defaults)
     * @return split ratios, with concierge=0 if no ManagementContract
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
                        BigDecimal ownerShare = BigDecimal.ONE.subtract(commissionRate);
                        BigDecimal platformShare = commissionRate.multiply(new BigDecimal("0.25"))
                            .setScale(4, RoundingMode.HALF_UP);
                        BigDecimal conciergeShare = commissionRate.subtract(platformShare);
                        log.info("Property {} has ManagementContract — 3-way split (commission={})",
                            propertyId, commissionRate);
                        return new SplitRatios(ownerShare, platformShare, conciergeShare);
                    }
                }

                // Property exists but no ManagementContract → no concierge
                log.info("No ManagementContract for property {} — 2-way split (no concierge)", propertyId);
                return resolveNoConciergeRatios(orgId);
            } catch (Exception e) {
                log.warn("Failed to check ManagementContract for property {}: {}", propertyId, e.getMessage());
            }
        }

        // No property context → use org defaults (may include concierge)
        return resolveSplitRatios(orgId);
    }

    /**
     * Returns split ratios with concierge=0.
     * The concierge share from org config (or defaults) is redirected to the owner.
     */
    private SplitRatios resolveNoConciergeRatios(Long orgId) {
        SplitRatios base = resolveSplitRatios(orgId);
        // Concierge share goes to owner
        BigDecimal ownerShare = base.ownerShare().add(base.conciergeShare());
        SplitRatios noConcierge = new SplitRatios(ownerShare, base.platformShare(), BigDecimal.ZERO);
        log.info("No-concierge ratios: owner={}, platform={}, concierge=0", ownerShare, base.platformShare());
        return noConcierge;
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
