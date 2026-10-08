package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.math.BigDecimal;
import java.util.*;

import static com.clenzy.service.InterventionPaymentBatch.require;

/** Des décisions bornées par part encaissée ; aucun appel PSP dans la transaction SQL. */
@Service
public class BaitlyBatchRefundPersistence {
    public static final String ALLOCATION_ID = "batchAllocationId";
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentCoordination coordination;
    private final com.clenzy.service.payout.BaitlyTransferRecoveryStore transferRecoveries;

    public BaitlyBatchRefundPersistence(EntityManager em, PaymentTransactionRepository payments,
            InterventionPaymentCoordination coordination, com.clenzy.service.payout.BaitlyTransferRecoveryStore transferRecoveries) {
        this.em = em; this.payments = payments; this.coordination = coordination;
        this.transferRecoveries = transferRecoveries;
    }

    public static boolean isAllocation(PaymentTransaction refund) {
        return refund.getMetadata() != null && refund.getMetadata().containsKey(ALLOCATION_ID);
    }

    @Transactional
    public String prepare(Long org, Long missionId) {
        return prepare(org, missionId, null, null);
    }

    @Transactional
    public String prepareInstallment(Long org, Long missionId, BigDecimal amount, UUID requestId) {
        require(requestId != null && amount != null && amount.signum() > 0 && amount.scale() <= 2,
                "Montant ou identifiant de demande invalide");
        return prepare(org, missionId, amount, requestId);
    }

    private String prepare(Long org, Long missionId, BigDecimal requested, UUID requestId) {
        var choices = em.createQuery("select a from InterventionPaymentAllocation a join fetch a.transaction t "
                + "where a.organizationId=:org and t.organizationId=:org and a.interventionId=:mission "
                + "and t.status<>com.clenzy.model.TransactionStatus.CANCELLED", InterventionPaymentAllocation.class)
            .setParameter("org", org).setParameter("mission", missionId).getResultList();
        require(choices.size() == 1, "Une seule part encaissée est nécessaire ; rapprochement requis");
        var payment = choices.getFirst().getTransaction();
        em.refresh(payment, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(payment.getOrganizationId(), org), "Encaissement hors organisation");
        require(!payment.hasDisputeRisk(), "Un litige bancaire doit être rapproché avant remboursement");
        var parts = parts(payment);
        var part = parts.stream().filter(a -> Objects.equals(a.getInterventionId(), missionId)).findFirst().orElseThrow();
        var mission = lockMission(org, missionId);
        require(Objects.equals(mission.getStripeSessionId(), payment.getProviderTxId())
                && equal(mission.getEstimatedCost(), part.getAmount())
                && Objects.equals(mission.getCurrency(), part.getCurrency()), "La mission et sa part encaissée doivent être rapprochées");
        var history = payments.findByOrganizationIdAndSourceTypeAndSourceId(org, "INTERVENTION", missionId);
        history.forEach(em::refresh);
        require(history.stream().noneMatch(t -> t.getPaymentType() == TransactionType.CHECKOUT
                && BaitlyCheckoutEvidence.requiresReconciliation(t)), "Plusieurs encaissements pour cette mission : rapprochement requis");
        var previous = history(payment, part);
        if (requestId == null && !previous.isEmpty()) {
            require(previous.size() == 1 && equal(previous.getFirst().getAmount(), part.getAmount()),
                    "Utilisez le solde remboursable pour poursuivre cette restitution partielle");
            return previous.getFirst().getTransactionRef();
        }
        for (var prior : previous) {
            if (requestId != null && requestId.toString().equals(prior.getMetadata().get("refundRequestId"))) {
                require(BaitlyRefundSeries.isSeries(prior) && equal(prior.getAmount(), requested),
                        "Cette demande existe déjà avec un autre montant");
                return prior.getTransactionRef();
            }
        }
        require(previous.stream().allMatch(p -> p.getStatus() == TransactionStatus.COMPLETED
                && BaitlyRefundEvidence.confirmedStripe(p)),
                "Un remboursement est encore en cours ou à rapprocher");
        BigDecimal before = previous.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal amount = requested == null ? part.getAmount() : requested;
        require(before.add(amount).compareTo(part.getAmount()) <= 0, "Le montant dépasse le solde remboursable de cette prestation");
        require(mission.getPaymentStatus() == (before.signum() == 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_REFUNDED),
                "La mission ou son remboursement précédent doit être rapproché");
        requireLedger(payment, part);
        coordination.requireRefundOutsideCancellationCase(payment);
        require(payments.findByOrganizationIdAndSourceTypeAndSourceId(org, payment.getSourceType(), payment.getSourceId())
                .stream().noneMatch(t -> t.getPaymentType() == TransactionType.REFUND && !(BaitlyRefundEvidence.distributed(t)
                    && BaitlyExternalRefundStore.confirmed(t) && t.getStatus()==TransactionStatus.COMPLETED
                    && !Boolean.TRUE.equals(t.getMetadata().get("reviewRequired")))),
                "Un ancien remboursement du lot doit être rapproché");
        var reserved = manifest(payment);
        require(reserved.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).add(amount)
                .compareTo(payment.getAmount()) <= 0, "Le remboursement dépasse le montant encaissé du lot");

        var refund = new PaymentTransaction();
        refund.setOrganizationId(org); refund.setTransactionRef("REF-" + UUID.randomUUID());
        refund.setPaymentType(TransactionType.REFUND); refund.setProviderType(PaymentProviderType.STRIPE);
        refund.setStatus(TransactionStatus.PROCESSING); refund.setAmount(amount); refund.setCurrency(part.getCurrency());
        refund.setSourceType("INTERVENTION"); refund.setSourceId(missionId);
        refund.setIdempotencyKey("REFUND-ALLOCATION-" + org + "-" + part.getId() + (requestId == null ? "" : "-" + requestId));
        var metadata = new HashMap<String, Object>();
        metadata.put("managedRefund", true); metadata.put("originalTransactionRef", payment.getTransactionRef());
        metadata.put(ALLOCATION_ID, part.getId().toString());
        if (requestId != null) {
            metadata.put("cumulativeRefund", true); metadata.put("refundRequestId", requestId.toString());
            metadata.put("refundBefore", before.toPlainString()); metadata.put("refundAfter", before.add(amount).toPlainString());
        }
        refund.setMetadata(metadata);
        payments.saveAndFlush(refund);
        transferRecoveries.prepareSeriesInterventionRefund(refund, part.getAmount().subtract(before));
        return refund.getTransactionRef();
    }

    /** Même ordre que la confirmation du lot : paiement, demande liée, mission. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Intervention lockMission(Long org, Long id) {
        var before = em.find(Intervention.class, id);
        require(before != null && Objects.equals(before.getOrganizationId(), org), "Mission hors organisation");
        Long requestId = before.getServiceRequest() == null ? null : before.getServiceRequest().getId();
        if (before.getServiceRequest() != null) {
            em.refresh(before.getServiceRequest(), LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(before.getServiceRequest().getOrganizationId(), org), "Demande hors organisation");
        }
        var mission = coordination.lockMission(org, id);
        require(Objects.equals(requestId, mission.getServiceRequest() == null ? null : mission.getServiceRequest().getId()),
                "La demande de la mission a changé ; réessayez");
        return mission;
    }

    @Transactional(readOnly = true)
    public InterventionPaymentAllocation validate(PaymentTransaction refund, PaymentTransaction payment) {
        var parts = parts(payment);
        require((PaymentPersistence.managedRefund(refund) || (BaitlyExternalBatchRefunds.assigned(refund)
                    && BaitlyExternalRefundStore.confirmed(refund))) && isAllocation(refund)
                && refund.getProviderType() == PaymentProviderType.STRIPE && "INTERVENTION".equals(refund.getSourceType())
                && Objects.equals(refund.getOrganizationId(), payment.getOrganizationId())
                && Objects.equals(refund.getCurrency(), payment.getCurrency())
                && payment.getTransactionRef().equals(refund.getMetadata().get("originalTransactionRef")),
                "Remboursement de part incohérent");
        if(refund.getRefundParent()!=null) BaitlyRefundEvidence.stripeReference(refund);
        var part = parts.stream().filter(a -> Objects.equals(a.getInterventionId(), refund.getSourceId())
                && a.getId().toString().equals(refund.getMetadata().get(ALLOCATION_ID))).findFirst().orElseThrow();
        require(refund.getAmount() != null && refund.getAmount().signum() > 0
                && (BaitlyRefundSeries.isSeries(refund) ? BaitlyRefundSeries.before(refund).signum() >= 0
                    && BaitlyRefundSeries.after(refund).compareTo(part.getAmount()) <= 0
                    : equal(part.getAmount(), refund.getAmount())), "Le remboursement dépasse la part encaissée");
        return part;
    }

    /** Appelé dans la transaction du demandeur ; ne marque pas rollback-only une lecture de capacité refusée. */
    public List<PaymentTransaction> history(PaymentTransaction payment, InterventionPaymentAllocation part) {
        var rows = payments.findByOrganizationIdAndSourceTypeAndSourceId(payment.getOrganizationId(), "INTERVENTION", part.getInterventionId());
        return history(payment, part, rows);
    }

    List<PaymentTransaction> history(PaymentTransaction payment, InterventionPaymentAllocation part, List<PaymentTransaction> rows) {
        var history = BaitlyRefundSeries.history(payment, rows, "INTERVENTION", part.getInterventionId(), part.getAmount());
        history.forEach(refund -> validate(refund, payment));
        return history;
    }

    /** Budget de toutes les restitutions du lot, y compris les preuves externes affectées et rapprochées. */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> manifest(PaymentTransaction payment) {
        var ids = parts(payment).stream().map(InterventionPaymentAllocation::getInterventionId).toList();
        var refunds = em.createQuery("select p from PaymentTransaction p where p.organizationId=:org "
                + "and p.sourceType='INTERVENTION' and p.sourceId in :ids "
                + "and p.paymentType=com.clenzy.model.TransactionType.REFUND", PaymentTransaction.class)
            .setParameter("org", payment.getOrganizationId()).setParameter("ids", ids).getResultList();
        var result = new LinkedHashMap<String, BigDecimal>();
        var used = new HashSet<Long>();
        var proofs = new HashSet<String>();
        for (var refund : refunds) {
            if(BaitlyExternalRefundStore.rejectedBeforeAccounting(refund)) continue;
            var part = validate(refund, payment);
            if (used.add(part.getId())) history(payment, part);
            require(refund.getProviderTxId() == null || proofs.add(refund.getProviderTxId()), "Preuve partagée entre plusieurs restitutions");
            result.put(refund.getTransactionRef(), refund.getAmount());
        }
        require(result.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(payment.getAmount()) <= 0,
                "Le cumul des remboursements dépasse le lot");
        return Map.copyOf(result);
    }

    /** Les preuves externes restent des observations, jamais des décisions autorisant un appel createRefund. */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> externalManifest(PaymentTransaction payment) {
        var manifest=manifest(payment);
        var result=new LinkedHashMap<String,BigDecimal>();
        for(var reference:manifest.keySet()) {
            var row=payments.findByTransactionRef(reference).orElseThrow();
            if(BaitlyExternalRefundStore.confirmed(row)) {
                require(row.getStatus()==TransactionStatus.COMPLETED && BaitlyRefundEvidence.confirmedStripe(row) && "succeeded".equals(row.getMetadata().get("stripeStatus")),
                        "Preuve externe de lot non confirmée");
                result.merge(BaitlyRefundEvidence.stripeReference(row),row.getAmount(),BigDecimal::add);
            }
        }
        return Map.copyOf(result);
    }

    @Transactional(readOnly = true)
    public Map<String, BigDecimal> managedManifest(PaymentTransaction payment) {
        var result=new LinkedHashMap<>(manifest(payment));
        result.keySet().removeIf(ref -> BaitlyExternalRefundStore.confirmed(payments.findByTransactionRef(ref).orElseThrow()));
        return Map.copyOf(result);
    }

    List<InterventionPaymentAllocation> parts(PaymentTransaction payment) {
        require(payment.getStatus() == TransactionStatus.COMPLETED && "EUR".equals(payment.getCurrency())
                && payment.getProviderTxId() != null && payment.getProviderTxId().startsWith("cs_"), "Lot non confirmé en EUR");
        var parts = em.createQuery("select a from InterventionPaymentAllocation a where a.organizationId=:org "
                + "and a.transaction.id=:payment order by a.interventionId", InterventionPaymentAllocation.class)
            .setParameter("org", payment.getOrganizationId()).setParameter("payment", payment.getId()).getResultList();
        InterventionPaymentBatch.validate(payment, parts);
        require(parts.stream().allMatch(a -> a.getConfirmedAt() != null), "Le lot n'est pas entièrement rapproché");
        return parts;
    }

    /** Facture tardive : seule une preuve complète de cette part peut constater son règlement historique. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void bindInvoice(Invoice invoice, PaymentTransaction refund, PaymentTransaction payment) {
        var part = validate(refund, payment);
        require(refund.getStatus() == TransactionStatus.COMPLETED
                && Objects.equals(invoice.getOrganizationId(), payment.getOrganizationId())
                && Objects.equals(invoice.getInterventionId(), part.getInterventionId()) && invoice.getReservationId() == null
                && invoice.getPayoutId() == null && invoice.getInvoiceType() == InvoiceType.GUEST
                && invoice.getOriginalInvoiceId() == null && invoice.getRefundTransactionId() == null && invoice.getDuplicateOfId() == null
                && Set.of(InvoiceStatus.PAID,InvoiceStatus.ISSUED,InvoiceStatus.SENT,InvoiceStatus.OVERDUE).contains(invoice.getStatus())
                && equal(invoice.getTotalTtc(), part.getAmount()) && Objects.equals(invoice.getCurrency(), part.getCurrency())
                && (invoice.getPaymentTransactionId() == null || Objects.equals(invoice.getPaymentTransactionId(), payment.getId())),
                "La facture ne correspond pas à la part remboursée");
        var otherAttempts = em.createQuery("select p from PaymentTransaction p where p.organizationId=:org and p.id<>:payment "
                + "and p.paymentType=com.clenzy.model.TransactionType.CHECKOUT and p.status<>com.clenzy.model.TransactionStatus.CANCELLED "
                + "and ((p.sourceType='INTERVENTION' and p.sourceId=:mission) or (p.sourceType='INVOICE' and p.sourceId=:invoice))", PaymentTransaction.class)
            .setParameter("org", payment.getOrganizationId()).setParameter("payment", payment.getId())
            .setParameter("mission", part.getInterventionId()).setParameter("invoice", invoice.getId()).getResultList();
        long cycles = em.createQuery("select count(a) from InterventionPaymentAllocation a join a.transaction p "
                + "where a.organizationId=:org and a.interventionId=:mission and p.status=com.clenzy.model.TransactionStatus.COMPLETED", Long.class)
            .setParameter("org", payment.getOrganizationId()).setParameter("mission", part.getInterventionId()).getSingleResult();
        require(otherAttempts.stream().noneMatch(BaitlyCheckoutEvidence::requiresReconciliation) && cycles == 1,
                "Plusieurs encaissements : la facture de cette part doit être rapprochée");
        invoice.setPaymentTransactionId(payment.getId()); invoice.setPaymentMethod("STRIPE"); invoice.setStatus(InvoiceStatus.PAID);
        if (invoice.getPaidAt() == null) invoice.setPaidAt(part.getConfirmedAt());
    }

    void requireLedger(PaymentTransaction payment, InterventionPaymentAllocation part) {
        String receipt = payment.getTransactionRef() + ":" + part.getInterventionId();
        var entries = em.createQuery("select e from LedgerEntry e where e.organizationId=:org "
                + "and ((e.referenceType=com.clenzy.model.LedgerReferenceType.PAYMENT and e.referenceId=:receipt) "
                + "or (e.referenceType=com.clenzy.model.LedgerReferenceType.SPLIT and e.referenceId=:split))", LedgerEntry.class)
            .setParameter("org", payment.getOrganizationId()).setParameter("receipt", receipt)
            .setParameter("split", "SPLIT-INTERVENTION-" + receipt).getResultList();
        BigDecimal collected = BigDecimal.ZERO;
        for (var entry : entries) {
            var other = entries.stream().filter(e -> Objects.equals(e.getId(), entry.getCounterpartEntryId())).findFirst().orElseThrow();
            require(Objects.equals(entry.getId(), other.getCounterpartEntryId()) && entry.getEntryType() != other.getEntryType()
                    && entry.getReferenceType() == other.getReferenceType() && Objects.equals(entry.getReferenceId(), other.getReferenceId())
                    && equal(entry.getAmount(), other.getAmount()) && entry.getAmount().signum() > 0
                    && Objects.equals(part.getCurrency(), entry.getCurrency()) && Objects.equals(part.getCurrency(), other.getCurrency()),
                    "Les écritures de cette prestation doivent être rapprochées");
            if (entry.getReferenceType() == LedgerReferenceType.PAYMENT && entry.getEntryType() == LedgerEntryType.DEBIT)
                collected = collected.add(entry.getAmount());
        }
        require(equal(collected, part.getAmount()), "L'encaissement de cette prestation manque dans le journal");
    }

    private static boolean equal(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) == 0;
    }
}
