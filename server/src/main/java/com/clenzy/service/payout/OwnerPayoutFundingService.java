package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.OwnerPayoutReservationRepository;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/** Preuves d'encaissement Baitly. COMPLETED ne prétend pas certifier le solde disponible du PSP. */
@Service
@Transactional(readOnly = true)
public class OwnerPayoutFundingService {
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager em;
    private final PaymentTransactionRepository transactions;
    private final OwnerPayoutReservationRepository claims;
    private final OwnerPayoutRepository payouts;
    private final ReservationRepository reservations;
    private final BaitlyOwnerPayoutDocuments documents;
    private final BaitlyExpenseRetention expenses;
    private final com.clenzy.booking.service.BaitlyReservationCredit credits;

    public OwnerPayoutFundingService(PaymentTransactionRepository transactions,
            OwnerPayoutReservationRepository claims, OwnerPayoutRepository payouts,
            ReservationRepository reservations, BaitlyOwnerPayoutDocuments documents, BaitlyExpenseRetention expenses,
            com.clenzy.booking.service.BaitlyReservationCredit credits) {
        this.credits = credits;
        this.transactions = transactions;
        this.claims = claims;
        this.payouts = payouts;
        this.reservations = reservations;
        this.documents = documents;
        this.expenses = expenses;
    }

    public record FundedStay(Reservation reservation, ReservationPayoutFunding.Evidence evidence) {}

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public List<FundedStay> select(Long ownerId, Long orgId, List<Reservation> candidates) {
        if (candidates.isEmpty()) return List.of();
        if (candidates.stream().anyMatch(r -> !belongsToOwner(r, ownerId, orgId))) throw invalidFunding();
        // Sérialise aussi la génération avec une annulation/remise en remboursement concurrente.
        candidates.stream().sorted(Comparator.comparing(Reservation::getId)).forEach(r -> {
            em.refresh(r, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if (!belongsToOwner(r, ownerId, orgId)) throw invalidFunding();
        });
        List<Long> ids = candidates.stream().map(Reservation::getId).toList();
        Set<Long> claimed = new HashSet<>(claims.findClaimedReservationIds(ids));
        Map<Long, List<PaymentTransaction>> receipts = receipts(orgId, ids);
        List<OwnerPayout> legacy = payouts.findByOwnerId(ownerId, orgId).stream()
                .filter(p -> p.getFundingVersion() == 0 && p.getStatus() != OwnerPayout.PayoutStatus.CANCELLED)
                .toList();
        return candidates.stream().filter(r -> !claimed.contains(r.getId()))
                .filter(r -> legacy.stream().noneMatch(p -> overlapsLegacy(r, p)))
                .flatMap(r -> ReservationPayoutFunding.evaluate(r, receipts.getOrDefault(r.getId(), List.of()))
                        .stream().map(e -> {
                            credits.requireConsumed(r);
                            documents.validateRefund(r, receipts.getOrDefault(r.getId(), List.of()));
                            return new FundedStay(r, e);
                        })).toList();
    }

    @Transactional
    public void record(OwnerPayout payout, List<FundedStay> stays) {
        claims.saveAllAndFlush(stays.stream().map(stay -> new OwnerPayoutReservation(
                stay.reservation().getId(), payout.getOrganizationId(), payout.getId(),
                stay.evidence().collectedAmount(), stay.evidence().currency(),
                stay.evidence().transactionIds())).toList());
    }

    @Transactional
    public void record(OwnerPayout payout,List<FundedStay> stays,Map<Long,BigDecimal> netShares) {
        if(netShares.size()!=stays.size() || netShares.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(payout.getNetAmount())!=0)
            throw invalidFunding();
        claims.saveAllAndFlush(stays.stream().map(stay -> {
            var claim=new OwnerPayoutReservation(stay.reservation().getId(),payout.getOrganizationId(),payout.getId(),
                    stay.evidence().collectedAmount(),stay.evidence().currency(),stay.evidence().transactionIds());
            claim.setNetAmount(netShares.get(stay.reservation().getId())); return claim;
        }).toList());
    }

    /** Recontrôlé à l'approbation ET avant exécution : une annulation invalide le financement. */
    public void validate(OwnerPayout payout) {
        validate(payout, false);
    }

    /** Sous les verrous de séjour détenus par la réservation de l'instruction. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void validateFresh(OwnerPayout payout) {
        validate(payout, true);
    }

    private void validate(OwnerPayout payout, boolean refresh) {
        if (payout.getFundingVersion() != 1) {
            throw new IllegalStateException("Reversement historique sans justificatifs d'encaissement : rapprochement requis avant paiement.");
        }
        List<OwnerPayoutReservation> lines = claims.findByPayoutIdAndOrganizationId(
                payout.getId(), payout.getOrganizationId());
        if (lines.isEmpty()) throw invalidFunding();
        List<Long> ids = lines.stream().map(OwnerPayoutReservation::getReservationId).toList();
        Map<Long, List<PaymentTransaction>> receipts = receipts(payout.getOrganizationId(), ids);
        if (refresh) receipts.values().forEach(rows -> rows.forEach(em::refresh));
        Map<Long, Reservation> stays = reservations.findAllById(ids).stream()
                .collect(Collectors.toMap(Reservation::getId, r -> r));
        BigDecimal collected = BigDecimal.ZERO;
        for (OwnerPayoutReservation line : lines) {
            Reservation stay = stays.get(line.getReservationId());
            validateOwner(stay, payout);
            if (payout.getPeriodStart() == null || payout.getPeriodEnd() == null
                    || !ReservationPayoutFunding.belongsToPeriod(stay, payout.getPeriodStart(), payout.getPeriodEnd())) {
                throw invalidFunding();
            }
            var evidence = ReservationPayoutFunding.evaluate(stay,
                    receipts.getOrDefault(stay.getId(), List.of())).orElseThrow(this::invalidFunding);
            credits.requireConsumed(stay);
            documents.validateRefund(stay, receipts.getOrDefault(stay.getId(), List.of()));
            if (!evidence.currency().equals(payout.getCurrency())
                    || !line.getCurrency().equals(evidence.currency())
                    || evidence.collectedAmount().compareTo(line.getCollectedAmount()) != 0
                    || !evidence.transactionIds().equals(line.getPaymentTransactionIds())) throw invalidFunding();
            collected = collected.add(line.getCollectedAmount());
        }
        validateAmounts(payout, collected);
        documents.validate(payout, lines, refresh);
        expenses.validate(payout, refresh);
    }

    private void validateOwner(Reservation stay, OwnerPayout payout) {
        if (!belongsToOwner(stay, payout.getOwnerId(), payout.getOrganizationId())) throw invalidFunding();
    }

    private boolean belongsToOwner(Reservation stay, Long ownerId, Long orgId) {
        return stay != null && Objects.equals(stay.getOrganizationId(), orgId)
                && stay.getProperty() != null && stay.getProperty().getOwner() != null
                && Objects.equals(stay.getProperty().getOrganizationId(), orgId)
                && Objects.equals(stay.getProperty().getOwner().getId(), ownerId);
    }

    private void validateAmounts(OwnerPayout payout, BigDecimal collected) {
        if (payout.getNetAmount() == null || payout.getNetAmount().signum() <= 0
                || payout.getGrossRevenue() == null || payout.getGrossRevenue().compareTo(collected) != 0
                || payout.getCommissionAmount() == null || payout.getCommissionAmount().signum() < 0
                || payout.getOtaFees() == null || payout.getOtaFees().signum() < 0
                || payout.getExpenses() == null || payout.getExpenses().signum() < 0
                || collected.subtract(payout.getCommissionAmount()).subtract(payout.getOtaFees())
                    .subtract(payout.getExpenses()).compareTo(payout.getNetAmount()) != 0) throw invalidFunding();
    }

    private Map<Long, List<PaymentTransaction>> receipts(Long orgId, List<Long> ids) {
        return transactions.findReservationFunding(orgId, ids, ReservationPayoutFunding.FUNDING_SOURCES).stream()
                .collect(Collectors.groupingBy(PaymentTransaction::getSourceId));
    }

    private boolean overlapsLegacy(Reservation stay, OwnerPayout payout) {
        // L'ancien calcul utilisait tout séjour chevauchant la période. Ne jamais le réémettre.
        return stay.getCheckIn() != null && payout.getPeriodStart() != null && payout.getPeriodEnd() != null
                && !stay.getCheckOut().isBefore(payout.getPeriodStart())
                && !stay.getCheckIn().isAfter(payout.getPeriodEnd());
    }

    private IllegalStateException invalidFunding() {
        return new IllegalStateException("Les encaissements de ce reversement doivent être rapprochés avant paiement.");
    }
}
