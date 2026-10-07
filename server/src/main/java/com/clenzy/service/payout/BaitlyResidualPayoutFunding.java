package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.BaitlyExternalRefundStore;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

/** Solde d'une prestation EUR après ses restitutions confirmées et rapprochées. */
@Service
@Transactional(readOnly = true)
public class BaitlyResidualPayoutFunding {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final com.clenzy.service.BaitlyBatchRefundPersistence batchRefunds;

    public BaitlyResidualPayoutFunding(EntityManager em, PaymentTransactionRepository payments,
            com.clenzy.service.BaitlyBatchRefundPersistence batchRefunds) {
        this.em = em;
        this.payments = payments;
        this.batchRefunds = batchRefunds;
    }

    public Optional<BigDecimal> available(Intervention mission) {
        if (mission.getPaymentStatus() != PaymentStatus.PARTIALLY_REFUNDED
                || !"EUR".equals(mission.getCurrency())) return Optional.empty();
        var history = payments.findByOrganizationIdAndSourceTypeAndSourceId(
                mission.getOrganizationId(), "INTERVENTION", mission.getId());
        // Une première lecture peut précéder l'attente du verrou de mission dans le même contexte JPA.
        history.forEach(em::refresh);
        var active = history.stream().filter(p -> p.getStatus() != TransactionStatus.CANCELLED)
                .filter(p -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)).toList();
        var receipts = active.stream().filter(p -> p.getPaymentType() == TransactionType.CHECKOUT).toList();
        var refunds = active.stream().filter(p -> p.getPaymentType() == TransactionType.REFUND).toList();
        var allocations = em.createQuery("select a from InterventionPaymentAllocation a join fetch a.transaction p "
                + "where a.organizationId=:org and a.interventionId=:mission and p.status<>com.clenzy.model.TransactionStatus.CANCELLED",
                InterventionPaymentAllocation.class).setParameter("org",mission.getOrganizationId())
                .setParameter("mission",mission.getId()).getResultList();
        boolean allocated = receipts.isEmpty() && allocations.size()==1;
        if ((!allocated && (receipts.size()!=1 || !allocations.isEmpty())) || refunds.isEmpty()
                || active.size()!=(allocated?0:1)+refunds.size()) return Optional.empty();
        var receipt = allocated ? allocations.getFirst().getTransaction() : receipts.getFirst();
        em.refresh(receipt);
        var paidBasis = allocated ? allocations.getFirst().getAmount() : receipt.getAmount();
        if (receipt.hasDisputeRisk() || !Objects.equals(receipt.getOrganizationId(),mission.getOrganizationId())
                || receipt.getStatus()!=TransactionStatus.COMPLETED || receipt.getPaymentType()!=TransactionType.CHECKOUT
                || receipt.getProviderType()!=PaymentProviderType.STRIPE || !"EUR".equals(receipt.getCurrency())
                || receipt.getProviderTxId()==null || receipt.getTransactionRef()==null) return Optional.empty();
        if (allocated) {
            try { batchRefunds.history(receipt,allocations.getFirst()); }
            catch (RuntimeException inconsistent) { return Optional.empty(); }
        }
        // Une preuve encore portée par le lot n'a pas de bénéficiaire métier identifié.
        if(allocated && payments.findByOrganizationIdAndSourceTypeAndSourceId(mission.getOrganizationId(),receipt.getSourceType(),receipt.getSourceId())
                .stream().anyMatch(p -> p.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)
                    && !com.clenzy.service.BaitlyRefundEvidence.reconciledDistribution(p)))
            return Optional.empty();
        BigDecimal refunded=refunds.stream().map(PaymentTransaction::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO,BigDecimal::add);
        for (var p : active) {
            if (!Objects.equals(p.getOrganizationId(), mission.getOrganizationId())
                    || !Objects.equals(p.getSourceId(), mission.getId()) || !"INTERVENTION".equals(p.getSourceType())
                    || p.getStatus() != TransactionStatus.COMPLETED || p.getProviderType() != PaymentProviderType.STRIPE
                    || !"EUR".equals(p.getCurrency()) || p.getAmount() == null || p.getAmount().signum() <= 0
                    || p.getId() == null || p.getTransactionRef() == null || (p.getProviderTxId() == null && p.getRefundParent()==null)) return Optional.empty();
        }
        BigDecimal expected = mission.getActualCost() != null ? mission.getActualCost() : mission.getEstimatedCost();
        if (expected == null || paidBasis == null || paidBasis.compareTo(expected) != 0
                || mission.getEstimatedCost() == null || paidBasis.compareTo(mission.getEstimatedCost()) != 0
                || !receipt.getProviderTxId().equals(mission.getStripeSessionId())
                || !receipt.getProviderTxId().startsWith("cs_") || refunded.compareTo(paidBasis) >= 0) return Optional.empty();
        BigDecimal before=BigDecimal.ZERO;
        for(var refund:refunds.stream().sorted(Comparator.comparing(com.clenzy.service.BaitlyRefundEvidence::order)).toList()) {
            boolean series=com.clenzy.service.BaitlyRefundSeries.isSeries(refund);
            if(!com.clenzy.service.BaitlyRefundEvidence.confirmedStripe(refund) || refund.getMetadata()==null
                    || Boolean.TRUE.equals(refund.getMetadata().get("reviewRequired"))
                    || (BaitlyExternalRefundStore.external(refund) && (!BaitlyExternalRefundStore.confirmed(refund)
                        || !Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired"))
                        || !"succeeded".equals(refund.getMetadata().get("stripeStatus"))))
                    || !receipt.getTransactionRef().equals(refund.getMetadata().get("originalTransactionRef"))
                    || (series ? com.clenzy.service.BaitlyRefundSeries.before(refund).compareTo(before)!=0
                        : !BaitlyExternalRefundStore.confirmed(refund) || before.signum()!=0
                            || !Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired"))
                            || !"succeeded".equals(refund.getMetadata().get("stripeStatus")))) return Optional.empty();
            before=before.add(refund.getAmount());
        }
        if (!allocated && receipt.getMetadata() != null && receipt.getMetadata().containsKey("interventionIds")
                && !mission.getId().toString().equals(Objects.toString(receipt.getMetadata().get("interventionIds"), "").trim()))
            return Optional.empty();
        if (mission.getServiceRequest() != null) {
            var need = mission.getServiceRequest();
            if (!Objects.equals(need.getOrganizationId(), mission.getOrganizationId())
                    || need.getPaymentStatus() != PaymentStatus.PARTIALLY_REFUNDED
                    || payments.findByOrganizationIdAndSourceTypeAndSourceId(mission.getOrganizationId(), "SERVICE_REQUEST", need.getId())
                        .stream().anyMatch(p -> p.getStatus() != TransactionStatus.CANCELLED)) return Optional.empty();
        }
        // La preuve PSP seule ne suffit pas : le rapprochement comptable doit être commité.
        var receiptRows = em.createQuery("from LedgerEntry e where e.organizationId=:org and e.referenceType=com.clenzy.model.LedgerReferenceType.PAYMENT "
                        + "and e.referenceId=:ref" + (allocated ? "" : " and e.description like 'Paiement intervention%'"), LedgerEntry.class)
                .setParameter("org", mission.getOrganizationId())
                .setParameter("ref", allocated ? receipt.getTransactionRef()+":"+mission.getId() : mission.getId().toString()).getResultList();
        var refundRows = em.createQuery("from LedgerEntry e where e.organizationId=:org and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND "
                        + "and e.referenceId in :refs", LedgerEntry.class)
                .setParameter("org", mission.getOrganizationId()).setParameter("refs", refunds.stream().map(PaymentTransaction::getTransactionRef).toList()).getResultList();
        if (!validPairs(receiptRows) || !validPairs(refundRows)) return Optional.empty();
        var debits = receiptRows.stream().filter(e -> e.getEntryType() == LedgerEntryType.DEBIT).toList();
        if (debits.size() != 1 || debits.getFirst().getAmount().compareTo(paidBasis) != 0) return Optional.empty();
        var debit = debits.getFirst();
        var credit = receiptRows.stream().filter(e -> e.getId().equals(debit.getCounterpartEntryId())).findFirst().orElseThrow();
        BigDecimal reversedReceipt = refundRows.stream().filter(e -> e.getEntryType() == LedgerEntryType.DEBIT
                        && e.getWalletId().equals(credit.getWalletId()))
                .filter(e -> refundRows.stream().anyMatch(c -> c.getId().equals(e.getCounterpartEntryId()) && c.getWalletId().equals(debit.getWalletId())))
                .map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (reversedReceipt.compareTo(refunded) != 0) return Optional.empty();
        for(var refund:refunds) {
            BigDecimal proof=refundRows.stream().filter(e -> refund.getTransactionRef().equals(e.getReferenceId())
                            && e.getEntryType()==LedgerEntryType.DEBIT && e.getWalletId().equals(credit.getWalletId()))
                    .filter(e -> refundRows.stream().anyMatch(c -> c.getId().equals(e.getCounterpartEntryId()) && c.getWalletId().equals(debit.getWalletId())))
                    .map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            if(proof.compareTo(refund.getAmount())!=0) return Optional.empty();
        }
        return Optional.of(paidBasis.subtract(refunded));
    }

    private boolean validPairs(List<LedgerEntry> rows) {
        return !rows.isEmpty() && rows.stream().allMatch(e -> e.getId() != null && e.getAmount() != null
                && e.getAmount().signum() > 0 && "EUR".equals(e.getCurrency())
                && rows.stream().anyMatch(c -> Objects.equals(c.getId(), e.getCounterpartEntryId())
                    && Objects.equals(c.getCounterpartEntryId(), e.getId()) && c.getEntryType() != e.getEntryType()
                    && c.getAmount().compareTo(e.getAmount()) == 0));
    }
}
