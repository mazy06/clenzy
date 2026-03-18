package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.User;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AccountingService {

    private static final Logger log = LoggerFactory.getLogger(AccountingService.class);


    private final OwnerPayoutRepository payoutRepository;
    private final ChannelCommissionRepository commissionRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final ProviderExpenseRepository providerExpenseRepository;
    private final ManagementContractService managementContractService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public AccountingService(OwnerPayoutRepository payoutRepository,
                             ChannelCommissionRepository commissionRepository,
                             ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository,
                             ProviderExpenseRepository providerExpenseRepository,
                             ManagementContractService managementContractService,
                             NotificationService notificationService,
                             UserRepository userRepository) {
        this.payoutRepository = payoutRepository;
        this.commissionRepository = commissionRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.providerExpenseRepository = providerExpenseRepository;
        this.managementContractService = managementContractService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    // ── Owner Payouts ──────────────────────────────────────────────────────

    public List<OwnerPayout> getPayouts(Long orgId) {
        return payoutRepository.findAllByOrgId(orgId);
    }

    public List<OwnerPayout> getPayoutsByOwner(Long ownerId, Long orgId) {
        return payoutRepository.findByOwnerId(ownerId, orgId);
    }

    public List<OwnerPayout> getPayoutsByStatus(PayoutStatus status, Long orgId) {
        return payoutRepository.findByStatus(status, orgId);
    }

    public OwnerPayout getPayoutById(Long id, Long orgId) {
        return payoutRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + id));
    }

    /**
     * Generate a payout for an owner, using the ManagementContract commission rate
     * when available. Falls back to DEFAULT_COMMISSION_RATE (20%) if no contract exists.
     *
     * Commission resolution priority:
     *   1. ManagementContract.commissionRate (per property — set by SUPER_ADMIN)
     *   2. DEFAULT_COMMISSION_RATE (20% — hardcoded fallback)
     */
    @Transactional
    public OwnerPayout generatePayout(Long ownerId, Long orgId, LocalDate from, LocalDate to) {
        // Check for existing payout
        Optional<OwnerPayout> existing = payoutRepository.findByOwnerAndPeriod(ownerId, from, to, orgId);
        if (existing.isPresent()) {
            return existing.get();
        }

        List<Reservation> reservations = reservationRepository.findByOwnerIdAndDateRange(ownerId, from, to, orgId);

        BigDecimal grossRevenue = reservations.stream()
            .map(Reservation::getTotalPrice)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Resolve commission rate from ManagementContract
        BigDecimal commissionRate = resolveCommissionRate(ownerId, orgId, reservations);
        BigDecimal commissionAmount = grossRevenue.multiply(commissionRate).setScale(2, RoundingMode.HALF_UP);

        // Aggregate APPROVED provider expenses for the owner's properties in this period
        List<ProviderExpense> approvedExpenses = providerExpenseRepository
                .findApprovedByPropertyOwnerAndPeriod(ownerId, from, to, orgId);
        BigDecimal totalExpenses = approvedExpenses.stream()
                .map(ProviderExpense::getAmountTtc)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netAmount = grossRevenue.subtract(commissionAmount).subtract(totalExpenses);

        OwnerPayout payout = new OwnerPayout();
        payout.setOrganizationId(orgId);
        payout.setOwnerId(ownerId);
        payout.setPeriodStart(from);
        payout.setPeriodEnd(to);
        payout.setGrossRevenue(grossRevenue);
        payout.setCommissionRate(commissionRate);
        payout.setCommissionAmount(commissionAmount);
        payout.setExpenses(totalExpenses);
        payout.setNetAmount(netAmount);
        payout.setStatus(PayoutStatus.PENDING);

        OwnerPayout savedPayout = payoutRepository.save(payout);

        // Mark expenses as INCLUDED and link to this payout
        for (ProviderExpense expense : approvedExpenses) {
            expense.setStatus(ExpenseStatus.INCLUDED);
            expense.setOwnerPayout(savedPayout);
        }
        if (!approvedExpenses.isEmpty()) {
            providerExpenseRepository.saveAll(approvedExpenses);
        }

        log.info("Generated payout for owner {} period {}-{}: gross={} commission={}% expenses={} net={}",
            ownerId, from, to, grossRevenue, commissionRate.multiply(BigDecimal.valueOf(100)),
            totalExpenses, netAmount);
        return savedPayout;
    }

    @Transactional
    public OwnerPayout approvePayout(Long id, Long orgId) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.APPROVED);
        OwnerPayout saved = payoutRepository.save(payout);

        String amount = saved.getNetAmount() + " " + saved.getCurrency();

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.PAYOUT_APPROVED,
                "Reversement approuve",
                "Le reversement #" + saved.getId() + " (" + amount + ") a ete approuve.",
                "/billing"
        );

        notifyOwner(saved, NotificationKey.PAYOUT_APPROVED,
                "Reversement approuve",
                "Votre reversement de " + amount + " (periode " + saved.getPeriodStart() + " - " + saved.getPeriodEnd() + ") a ete approuve.");

        return saved;
    }

    @Transactional
    public OwnerPayout markAsPaid(Long id, Long orgId, String paymentReference) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaymentReference(paymentReference);
        payout.setPaidAt(Instant.now());
        OwnerPayout saved = payoutRepository.save(payout);

        String amount = saved.getNetAmount() + " " + saved.getCurrency();

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.PAYOUT_EXECUTED,
                "Reversement execute",
                "Le reversement #" + saved.getId() + " (" + amount + ") a ete paye. Ref: " + paymentReference,
                "/billing"
        );

        notifyOwner(saved, NotificationKey.PAYOUT_EXECUTED,
                "Reversement effectue",
                "Votre reversement de " + amount + " a ete effectue. Reference: " + paymentReference);

        return saved;
    }

    // ── Channel Commissions ────────────────────────────────────────────────

    public List<ChannelCommission> getChannelCommissions(Long orgId) {
        return commissionRepository.findByOrganizationId(orgId);
    }

    public Optional<ChannelCommission> getChannelCommission(ChannelName channel, Long orgId) {
        return commissionRepository.findByChannelAndOrgId(channel, orgId);
    }

    @Transactional
    public ChannelCommission saveChannelCommission(ChannelCommission commission) {
        return commissionRepository.save(commission);
    }

    // ── Private Helpers ────────────────────────────────────────────────────

    /**
     * Sends an in-app notification to the owner of a payout.
     * Silently skipped if the owner user is not found (defensive).
     */
    private void notifyOwner(OwnerPayout payout, NotificationKey key, String title, String message) {
        userRepository.findById(payout.getOwnerId()).ifPresent(owner -> {
            if (owner.getKeycloakId() != null) {
                notificationService.sendByOrgId(
                        owner.getKeycloakId(), key, title, message,
                        "/billing", payout.getOrganizationId()
                );
            }
        });
    }

    /**
     * Resolves commission rate for a set of reservations belonging to an owner.
     * Uses the first reservation's property to find the ManagementContract.
     * If multiple properties have different rates, uses the first match.
     */
    private BigDecimal resolveCommissionRate(Long ownerId, Long orgId, List<Reservation> reservations) {
        // Try to find a ManagementContract commission rate from the reservations' properties
        for (Reservation reservation : reservations) {
            if (reservation.getProperty() != null) {
                Long propertyId = reservation.getProperty().getId();
                Optional<ManagementContract> contractOpt =
                    managementContractService.getActiveContract(propertyId, orgId);
                if (contractOpt.isPresent() && contractOpt.get().getCommissionRate() != null) {
                    BigDecimal contractRate = contractOpt.get().getCommissionRate();
                    log.debug("Using ManagementContract commission rate {} for property {} owner {}",
                        contractRate, propertyId, ownerId);
                    return contractRate;
                }
            }
        }

        // Pas de contrat = pas de commission
        log.debug("No ManagementContract found for owner {}, commission rate = 0", ownerId);
        return BigDecimal.ZERO;
    }
}
