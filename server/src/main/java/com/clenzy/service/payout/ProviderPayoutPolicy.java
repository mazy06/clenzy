package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

/** Règles communes à tous les métiers du catalogue et de la marketplace. */
@Service
@Transactional(readOnly = true)
public class ProviderPayoutPolicy {
    private final PaymentTransactionRepository transactions;
    private final ServiceCatalogReference catalog;
    private final com.clenzy.repository.InterventionPaymentAllocationRepository allocations;
    private final BaitlyResidualPayoutFunding residualFunding;
    public ProviderPayoutPolicy(PaymentTransactionRepository transactions, ServiceCatalogReference catalog,
            com.clenzy.repository.InterventionPaymentAllocationRepository allocations, BaitlyResidualPayoutFunding residualFunding) {
        this.transactions = transactions; this.catalog = catalog; this.allocations = allocations;
        this.residualFunding = residualFunding;
    }

    public String blockingReason(Intervention mission) {
        if (mission.getStatus() != InterventionStatus.COMPLETED) return "MISSION_NOT_COMPLETED";
        // Le circuit historique ne sait décaisser que des EUR : ne jamais réinterpréter un prix MAD/SAR.
        if (!"EUR".equals(ReservationPayoutFunding.currency(mission.getCurrency()))) return "PAYOUT_CURRENCY_UNSUPPORTED";
        if (mission.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED)
            return residualFunding.available(mission).isPresent() ? null : "PAYMENT_RECONCILIATION_REQUIRED";
        if (mission.getPaymentStatus() != PaymentStatus.PAID) return "PAYMENT_NOT_RECEIVED";
        BigDecimal expected = mission.getActualCost() != null ? mission.getActualCost() : mission.getEstimatedCost();
        if (expected == null || expected.signum() <= 0) return "AMOUNT_NOT_POSITIVE";
        var receipts = new ArrayList<>(transactions.findByOrganizationIdAndSourceTypeAndSourceId(
                mission.getOrganizationId(), "INTERVENTION", mission.getId()));
        ServiceRequest need = mission.getServiceRequest();
        if (need != null && Objects.equals(need.getOrganizationId(), mission.getOrganizationId())
                && Objects.equals(need.getConvertedInterventionId(), mission.getId())) {
            receipts.addAll(transactions.findByOrganizationIdAndSourceTypeAndSourceId(
                    mission.getOrganizationId(), "SERVICE_REQUEST", need.getId()));
        }
        var collected = new HashMap<String, BigDecimal>();
        if (!collectUnitPayments(mission, receipts, collected)) return "PAYMENT_RECONCILIATION_REQUIRED";
        for (var part : allocations.findForMission(mission.getOrganizationId(), mission.getId())) {
            var tx = part.getTransaction();
            if (tx.hasDisputeRisk()) return "PAYMENT_DISPUTED";
            if (tx.getStatus() == TransactionStatus.REFUNDED) return "PAYMENT_RECONCILIATION_REQUIRED";
            if (tx.getStatus() != TransactionStatus.COMPLETED) continue;
            var entireBatch = allocations.findForTransaction(mission.getOrganizationId(), tx.getTransactionRef());
            try { com.clenzy.service.InterventionPaymentBatch.validate(tx, entireBatch); }
            catch (IllegalStateException ex) { return "PAYMENT_RECONCILIATION_REQUIRED"; }
            if (entireBatch.stream().anyMatch(a -> a.getConfirmedAt() == null)
                    || part.getConfirmedAt() == null || !"EUR".equals(part.getCurrency())
                    || tx.getProviderTxId() == null || tx.getProviderTxId().isBlank()
                    || transactions.findByOrganizationIdAndSourceTypeAndSourceId(mission.getOrganizationId(),
                        tx.getSourceType(), tx.getSourceId()).stream().anyMatch(ProviderPayoutPolicy::hasRefundRisk)
                    || collected.putIfAbsent(tx.getProviderTxId(), part.getAmount()) != null) {
                return "PAYMENT_RECONCILIATION_REQUIRED";
            }
        }
        return collected.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(expected) == 0
                ? null : "PAYMENT_RECONCILIATION_REQUIRED";
    }

    /** Assiette du versement : montant encaissé conservé, jamais le prix avant remboursement. */
    public BigDecimal payableGross(Intervention mission) {
        if (mission.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED)
            return residualFunding.available(mission).orElseThrow(() ->
                    new IllegalStateException("Le remboursement partiel doit être rapproché avant versement."));
        return mission.getActualCost() != null ? mission.getActualCost() : mission.getEstimatedCost();
    }

    static boolean fullyFunded(Intervention mission, BigDecimal expected, List<PaymentTransaction> receipts) {
        Map<String, BigDecimal> collected = new HashMap<>();
        return collectUnitPayments(mission, receipts, collected)
                && collected.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(expected) == 0;
    }

    private static boolean hasRefundRisk(PaymentTransaction tx) {
        if(com.clenzy.service.BaitlyRefundEvidence.reconciledDistribution(tx)) return false;
        return tx.getStatus() == TransactionStatus.REFUNDED || (tx.getPaymentType() == TransactionType.REFUND
                && tx.getStatus() != TransactionStatus.FAILED && tx.getStatus() != TransactionStatus.CANCELLED);
    }

    private static boolean collectUnitPayments(Intervention mission, List<PaymentTransaction> receipts,
            Map<String, BigDecimal> collected) {
        for (PaymentTransaction tx : receipts) {
            if (!Objects.equals(tx.getOrganizationId(), mission.getOrganizationId())) return false;
            if (tx.hasDisputeRisk()) return false;
            if (hasRefundRisk(tx)) return false;
            if (tx.getStatus() != TransactionStatus.COMPLETED || tx.getPaymentType() != TransactionType.CHECKOUT) continue;
            if (tx.getProviderType() != PaymentProviderType.STRIPE || tx.getProviderTxId() == null
                    || tx.getProviderTxId().isBlank() || tx.getAmount() == null || tx.getAmount().signum() <= 0
                    || !"EUR".equals(ReservationPayoutFunding.currency(tx.getCurrency()))) return false;
            // Un encaissement de lot ne prouve pas la part de cette mission : rapprochement explicite.
            if (tx.getMetadata() != null && tx.getMetadata().containsKey("interventionIds")
                    && !String.valueOf(mission.getId()).equals(String.valueOf(tx.getMetadata().get("interventionIds")).trim())) return false;
            BigDecimal previous = collected.putIfAbsent(tx.getProviderTxId(), tx.getAmount());
            if (previous != null && previous.compareTo(tx.getAmount()) != 0) return false;
        }
        return true;
    }

    public String commissionCategory(Intervention mission) {
        String category = catalog.categoryCode(mission.getServiceItemCode());
        if (category == null) {
            InterventionType legacy = InterventionType.fromString(mission.getType());
            if (legacy != null && legacy.isCleaning()) return "entretien";
            if (legacy != null && legacy.isMaintenance()) return "travaux";
            if (legacy == InterventionType.GARDENING || legacy == InterventionType.EXTERIOR_CLEANING
                    || legacy == InterventionType.PEST_CONTROL) return "exterieur";
            return "other";
        }
        return switch (category) {
            case "CLEANING" -> "entretien";
            case "MAINTENANCE", "LOCKSMITH" -> "travaux";
            case "LAUNDRY", "LINEN" -> "blanchisserie";
            case "EXTERIOR", "POOL" -> "exterieur";
            default -> category.toLowerCase(Locale.ROOT);
        };
    }
}
