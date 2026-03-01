package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
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
    private static final BigDecimal DEFAULT_COMMISSION_RATE = new BigDecimal("0.2000");

    private final OwnerPayoutRepository payoutRepository;
    private final ChannelCommissionRepository commissionRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;

    public AccountingService(OwnerPayoutRepository payoutRepository,
                             ChannelCommissionRepository commissionRepository,
                             ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository) {
        this.payoutRepository = payoutRepository;
        this.commissionRepository = commissionRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
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

        BigDecimal commissionRate = DEFAULT_COMMISSION_RATE;
        BigDecimal commissionAmount = grossRevenue.multiply(commissionRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = grossRevenue.subtract(commissionAmount);

        OwnerPayout payout = new OwnerPayout();
        payout.setOrganizationId(orgId);
        payout.setOwnerId(ownerId);
        payout.setPeriodStart(from);
        payout.setPeriodEnd(to);
        payout.setGrossRevenue(grossRevenue);
        payout.setCommissionRate(commissionRate);
        payout.setCommissionAmount(commissionAmount);
        payout.setNetAmount(netAmount);
        payout.setStatus(PayoutStatus.PENDING);

        log.info("Generated payout for owner {} period {}-{}: gross={} net={}",
            ownerId, from, to, grossRevenue, netAmount);
        return payoutRepository.save(payout);
    }

    @Transactional
    public OwnerPayout approvePayout(Long id, Long orgId) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.APPROVED);
        return payoutRepository.save(payout);
    }

    @Transactional
    public OwnerPayout markAsPaid(Long id, Long orgId, String paymentReference) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaymentReference(paymentReference);
        payout.setPaidAt(Instant.now());
        return payoutRepository.save(payout);
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
}
