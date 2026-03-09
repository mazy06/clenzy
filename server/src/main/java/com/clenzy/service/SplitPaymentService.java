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
     * Resolve split ratios with full priority chain.
     * Used when a reservationId is available to look up the property's ManagementContract.
     *
     * Priority:
     *   1. ManagementContract.commissionRate for the reservation's property
     *   2. SplitConfiguration for the organization (SUPER_ADMIN configurable)
     *   3. System defaults (80/5/15)
     */
    public SplitRatios resolveSplitRatios(Long orgId, Long reservationId) {
        // 1. Try ManagementContract (per-property commission rate)
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
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to resolve ManagementContract ratios for reservation {}: {}",
                    reservationId, e.getMessage());
            }
        }

        // 2. Fallback to org-level SplitConfiguration
        return resolveSplitRatios(orgId);
    }

    /**
     * Resolve split ratios for an organization (without reservation context).
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
