package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Affectation explicite d’une preuve Stripe aux prestations du lot Baitly. Aucun appel PSP. */
@Service
public class BaitlyExternalBatchRefunds {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final BaitlyBatchRefundPersistence batches;
    private final InterventionPaymentCoordination coordination;
    private final BaitlyTransferRecoveryStore recoveries;

    public BaitlyExternalBatchRefunds(EntityManager em, PaymentTransactionRepository payments,
            BaitlyBatchRefundPersistence batches, InterventionPaymentCoordination coordination,
            BaitlyTransferRecoveryStore recoveries) {
        this.em=em; this.payments=payments; this.batches=batches; this.coordination=coordination; this.recoveries=recoveries;
    }

    public record Item(String reference, String stripeReference, BigDecimal amount, String currency,
            Long interventionId, boolean assigned, boolean confirmed, boolean assignable, boolean reviewRequired) {}
    public record Portion(Long interventionId, BigDecimal amount) {}
    public record Target(Long interventionId, String label, BigDecimal remaining, String currency) {}

    @Transactional(readOnly=true)
    public List<Target> targets(Long org,Long missionId) {
        var choices=allocations(org,missionId);
        require(choices.size()==1,"Un seul lot est nécessaire");
        var original=choices.getFirst().getTransaction();
        return batches.parts(original).stream().map(part -> {
            var mission=em.find(Intervention.class,part.getInterventionId());
            require(mission!=null && Objects.equals(org,mission.getOrganizationId()),"Prestation inaccessible");
            var reserved=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",mission.getId()).stream()
                    .filter(r -> r.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(r))
                    .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            return new Target(mission.getId(),"Prestation #"+mission.getId(),part.getAmount().subtract(reserved),part.getCurrency());
        }).toList();
    }

    /** La décision entière est atomique et immuable, avec un seul justificatif bancaire. */
    @Transactional
    public Item distribute(Long org,Long missionId,String reference,BigDecimal amount,String currency,
            List<Portion> portions,String reason,String actor) {
        require(portions!=null && !portions.isEmpty() && portions.size()<=100 && amount!=null && amount.signum()>0
                && amount.scale()<=2 && "EUR".equals(currency) && reason!=null && !reason.isBlank() && reason.length()<=500
                && actor!=null && !actor.isBlank(),"Répartition, montant, devise, motif et auteur sont nécessaires");
        var decisions=new TreeMap<Long,BigDecimal>();
        for(var portion:portions) require(portion!=null && portion.interventionId()!=null && portion.amount()!=null
                && portion.amount().signum()>0 && portion.amount().scale()<=2
                && decisions.putIfAbsent(portion.interventionId(),portion.amount().setScale(2))==null,"Affectation invalide ou répétée");
        require(decisions.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(amount)==0,
                "La somme des affectations doit être égale au remboursement Stripe");
        var choices=allocations(org,missionId); require(choices.size()==1,"Un seul lot est nécessaire");
        var original=choices.getFirst().getTransaction(); em.refresh(original,LockModeType.PESSIMISTIC_WRITE);
        require(!original.hasDisputeRisk(),"Le litige du lot doit être rapproché");
        var parts=batches.parts(original);
        var refund=payments.lockByReference(org,reference).orElseThrow(); em.refresh(refund);
        require(BaitlyExternalRefundStore.external(refund) && refund.getRefundParent()==null
                && refund.getProviderType()==PaymentProviderType.STRIPE && BaitlyRefundEvidence.confirmedStripe(refund)
                && Objects.equals(org,refund.getOrganizationId()) && same(amount,refund.getAmount())
                && currency.equals(refund.getCurrency()) && original.getTransactionRef().equals(refund.getMetadata().get("originalTransactionRef")),
                "Preuve différente du remboursement à répartir");
        var manifest=new LinkedHashMap<String,String>(); decisions.forEach((id,value)->manifest.put(id.toString(),value.toPlainString()));
        if(BaitlyRefundEvidence.distributed(refund)) {
            require(manifest.equals(refund.getMetadata().get("refundAssignments")),"Cette preuve possède déjà une autre répartition");
            children(refund); return item(refund);
        }
        require(!assigned(refund) && refund.getStatus()==TransactionStatus.PROCESSING && !BaitlyExternalRefundStore.confirmed(refund)
                && "succeeded".equals(refund.getMetadata().get("stripeStatus"))
                && Objects.equals(refund.getSourceType(),original.getSourceType()) && Objects.equals(refund.getSourceId(),original.getSourceId()),
                "Cette preuve ne peut plus être répartie");
        for(var decision:decisions.entrySet()) {
            var part=parts.stream().filter(p->p.getInterventionId().equals(decision.getKey())).findFirst().orElseThrow();
            var mission=batches.lockMission(org,decision.getKey());
            require(allocations(org,mission.getId()).size()==1 && Objects.equals(mission.getStripeSessionId(),original.getProviderTxId())
                    && currency.equals(mission.getCurrency()) && same(mission.getEstimatedCost(),part.getAmount()),"Prestation différente du lot encaissé");
            var previous=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",mission.getId()); previous.forEach(em::refresh);
            require(previous.stream().noneMatch(p->p.getPaymentType()==TransactionType.CHECKOUT && BaitlyCheckoutEvidence.requiresReconciliation(p)),"Autre encaissement à rapprocher");
            BigDecimal reserved=BigDecimal.ZERO;
            for(var row:previous) if(row.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(row)) {
                require(row.getMetadata()!=null && original.getTransactionRef().equals(row.getMetadata().get("originalTransactionRef"))
                        && BaitlyBatchRefundPersistence.isAllocation(row),"Remboursement historique à rapprocher");
                reserved=reserved.add(row.getAmount());
            }
            require(reserved.add(decision.getValue()).compareTo(part.getAmount())<=0,"Une affectation dépasse le solde de sa prestation");
        }
        var metadata=new HashMap<>(refund.getMetadata()); metadata.put("externalBatchDistributed",true);
        metadata.put("refundAssignments",manifest); metadata.put("assignedBy",actor); metadata.put("assignedAt",Instant.now().toString());
        metadata.put("assignmentReason",reason.trim()); metadata.put("reviewRequired",true); metadata.remove("reviewCheckedAt"); refund.setMetadata(metadata);
        for(var decision:decisions.entrySet()) {
            var part=parts.stream().filter(p->p.getInterventionId().equals(decision.getKey())).findFirst().orElseThrow();
            var child=new PaymentTransaction(); child.setOrganizationId(org); child.setRefundParent(refund);
            child.setTransactionRef("ALLOC-"+UUID.randomUUID()); child.setIdempotencyKey("EXT-ALLOCATION-"+refund.getId()+"-"+part.getId());
            child.setPaymentType(TransactionType.REFUND); child.setProviderType(PaymentProviderType.STRIPE); child.setStatus(TransactionStatus.PROCESSING);
            child.setSourceType("INTERVENTION"); child.setSourceId(part.getInterventionId()); child.setAmount(decision.getValue()); child.setCurrency(currency);
            child.setMetadata(Map.of("externalRefund",true,"externalBatchAssigned",true,"originalTransactionRef",original.getTransactionRef(),
                    BaitlyBatchRefundPersistence.ALLOCATION_ID,part.getId().toString(),"stripeStatus","succeeded","reviewRequired",true));
            payments.save(child);
        }
        em.flush(); return item(refund);
    }

    List<PaymentTransaction> children(PaymentTransaction parent) {
        var rows=em.createQuery("from PaymentTransaction where refundParent.id=:parent and organizationId=:org order by id",PaymentTransaction.class)
                .setParameter("parent",parent.getId()).setParameter("org",parent.getOrganizationId()).getResultList();
        require(parent.getMetadata().get("refundAssignments") instanceof Map<?,?>,"Répartition absente");
        var expected=(Map<?,?>)parent.getMetadata().get("refundAssignments"); var seen=new HashSet<Long>();
        require(rows.size()==expected.size() && !rows.isEmpty(),"Répartition incomplète");
        for(var child:rows) require(assigned(child) && child.getProviderTxId()==null && seen.add(child.getSourceId())
                && Objects.equals(child.getCurrency(),parent.getCurrency())
                && Objects.equals(expected.get(child.getSourceId().toString()),child.getAmount().toPlainString()),"Répartition incohérente");
        require(rows.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(parent.getAmount())==0,"Total réparti incohérent");
        return rows;
    }

    public static boolean assigned(PaymentTransaction refund) {
        return BaitlyExternalRefundStore.external(refund) && BaitlyBatchRefundPersistence.isAllocation(refund)
                && Boolean.TRUE.equals(refund.getMetadata().get("externalBatchAssigned"))
                && "INTERVENTION".equals(refund.getSourceType());
    }

    @Transactional(readOnly=true)
    public List<Item> list(Long org, Long missionId) {
        var mission=em.find(Intervention.class,missionId);
        require(mission!=null && Objects.equals(org,mission.getOrganizationId()),"Prestation inaccessible");
        var choices=allocations(org,missionId);
        if(choices.isEmpty()) return List.of();
        require(choices.size()==1,"Plusieurs lots doivent être rapprochés");
        var original=choices.getFirst().getTransaction();
        if(original.getStatus()!=TransactionStatus.COMPLETED) return List.of();
        return rows(original).stream().filter(BaitlyExternalRefundStore::external)
                .filter(r -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(r))
                .filter(r -> !assigned(r) || Objects.equals(missionId,r.getSourceId()))
                .map(this::item).toList();
    }

    /** Une affectation est immuable. Le rejeu vérifie les mêmes montants, sans émettre de remboursement. */
    @Transactional
    public Item assign(Long org, Long missionId, String reference, BigDecimal amount, String currency,
            String reason, String actor) {
        require(amount!=null && amount.signum()>0 && amount.scale()<=2 && "EUR".equals(currency)
                && reason!=null && !reason.isBlank() && reason.length()<=500 && actor!=null && !actor.isBlank(),
                "Montant, devise, motif et auteur sont nécessaires");
        var choices=allocations(org,missionId);
        require(choices.size()==1,"Une seule part encaissée est nécessaire");
        var original=choices.getFirst().getTransaction();
        em.refresh(original,LockModeType.PESSIMISTIC_WRITE);
        require(!original.hasDisputeRisk(),"Le litige du lot doit être rapproché");
        var part=batches.parts(original).stream().filter(p -> Objects.equals(missionId,p.getInterventionId())).findFirst().orElseThrow();
        var mission=batches.lockMission(org,missionId);
        require(Objects.equals(mission.getStripeSessionId(),original.getProviderTxId())
                && Objects.equals(mission.getCurrency(),currency) && same(mission.getEstimatedCost(),part.getAmount()),
                "La prestation ne correspond plus à la part encaissée");
        var refund=payments.lockByReference(org,reference).orElseThrow(); em.refresh(refund);
        require(BaitlyExternalRefundStore.external(refund) && refund.getProviderType()==PaymentProviderType.STRIPE
                && Objects.equals(org,refund.getOrganizationId()) && original.getTransactionRef().equals(refund.getMetadata().get("originalTransactionRef"))
                && same(amount,refund.getAmount()) && currency.equals(refund.getCurrency())
                && refund.getProviderTxId()!=null && refund.getProviderTxId().startsWith("re_"),"Preuve de remboursement différente");
        if(assigned(refund)) {
            require(Objects.equals(missionId,refund.getSourceId()) && part.getId().toString().equals(refund.getMetadata().get(BaitlyBatchRefundPersistence.ALLOCATION_ID)),
                    "Cette preuve est déjà affectée à une autre prestation");
            return item(refund);
        }
        require(!BaitlyRefundEvidence.distributed(refund) && refund.getStatus()==TransactionStatus.PROCESSING && !BaitlyExternalRefundStore.confirmed(refund)
                && "succeeded".equals(refund.getMetadata().get("stripeStatus"))
                && Objects.equals(original.getSourceType(),refund.getSourceType()) && Objects.equals(original.getSourceId(),refund.getSourceId()),
                "Seule une preuve externe confirmée par Stripe et non affectée peut être rapprochée");
        var other=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",missionId);
        other.forEach(em::refresh);
        require(other.stream().noneMatch(p -> p.getPaymentType()==TransactionType.CHECKOUT && BaitlyCheckoutEvidence.requiresReconciliation(p)),
                "Un autre encaissement doit être rapproché");
        BigDecimal reserved=BigDecimal.ZERO;
        for(var row:other) if(row.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(row)) {
            require(row.getMetadata()!=null && original.getTransactionRef().equals(row.getMetadata().get("originalTransactionRef"))
                    && BaitlyBatchRefundPersistence.isAllocation(row) && row.getAmount()!=null && row.getAmount().signum()>0,
                    "Une restitution historique doit être rapprochée");
            reserved=reserved.add(row.getAmount());
        }
        require(reserved.add(amount).compareTo(part.getAmount())<=0,"Le remboursement dépasse le solde de cette prestation ; ne répartissez pas arbitrairement une preuve entre plusieurs prestations");
        var metadata=new HashMap<>(refund.getMetadata());
        metadata.put("externalBatchAssigned",true); metadata.put(BaitlyBatchRefundPersistence.ALLOCATION_ID,part.getId().toString());
        metadata.put("originalSourceType",original.getSourceType()); metadata.put("originalSourceId",original.getSourceId().toString());
        metadata.put("assignedBy",actor); metadata.put("assignedAt",Instant.now().toString()); metadata.put("assignmentReason",reason.trim());
        metadata.remove("reviewCheckedAt");
        metadata.put("reviewRequired",true); refund.setMetadata(metadata);
        refund.setSourceType("INTERVENTION"); refund.setSourceId(missionId);
        return item(refund);
    }

    /** Appelé sous le verrou de l'encaissement, après relecture de la liste complète chez Stripe. */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void reconcile(PaymentTransaction original, PaymentTransaction current, List<BaitlyExternalRefundProof> snapshot) {
        require((assigned(current) || BaitlyRefundEvidence.distributed(current)) && original.getStatus()==TransactionStatus.COMPLETED && !original.hasDisputeRisk(),
                "Affectez la preuve externe à une prestation avant son rapprochement");
        var parts=batches.parts(original);
        var proofs=new HashMap<String,BaitlyExternalRefundProof>();
        for(var proof:snapshot) {
            proof.requireOriginal(original);
            require("succeeded".equals(proof.stripeStatus()) && proofs.putIfAbsent(proof.refundId(),proof)==null,"Photographie Stripe incohérente");
        }
        var rows=rows(original).stream().filter(r -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(r)).toList();
        rows.forEach(em::refresh);
        require(rows.size()==proofs.size(),"Un remboursement Stripe reste à rapprocher");
        var used=new HashSet<String>(); BigDecimal total=BigDecimal.ZERO;
        for(var row:rows) {
            var proof=proofs.get(row.getProviderTxId());
            require(proof!=null && used.add(row.getProviderTxId()) && same(row.getAmount(),proof.amount())
                    && Objects.equals(row.getCurrency(),original.getCurrency()) && row.getProviderType()==PaymentProviderType.STRIPE,
                    "Preuve de remboursement du lot incohérente");
            require((row.getStatus()==TransactionStatus.COMPLETED && (PaymentPersistence.managedRefund(row) || BaitlyExternalRefundStore.confirmed(row)))
                    || (BaitlyExternalRefundStore.external(row) && !BaitlyExternalRefundStore.confirmed(row)
                        && row.getStatus()==TransactionStatus.PROCESSING && "succeeded".equals(row.getMetadata().get("stripeStatus"))),
                    "Une autre restitution doit être rapprochée");
            if(row.getId()<current.getId()) require(row.getStatus()==TransactionStatus.COMPLETED
                    && !Boolean.TRUE.equals(row.getMetadata().get("reviewRequired")),"Le remboursement précédent doit être rapproché");
            total=total.add(row.getAmount());
        }
        require(total.compareTo(original.getAmount())<=0,"Le cumul dépasse le montant du lot");
        if(BaitlyRefundEvidence.distributed(current)) return;
        reconcilePart(original,current);
    }

    void reconcilePart(PaymentTransaction original,PaymentTransaction current) {
        var part=batches.parts(original).stream().filter(p -> Objects.equals(p.getInterventionId(),current.getSourceId())
                && p.getId().toString().equals(current.getMetadata().get(BaitlyBatchRefundPersistence.ALLOCATION_ID))).findFirst().orElseThrow();
        var prior=payments.findByOrganizationIdAndSourceTypeAndSourceId(original.getOrganizationId(),"INTERVENTION",part.getInterventionId())
                .stream().filter(r -> BaitlyRefundEvidence.order(r)<BaitlyRefundEvidence.order(current)).toList();
        var previous=batches.history(original,part,prior);
        BigDecimal before=previous.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(before.add(current.getAmount()).compareTo(part.getAmount())<=0,"Le cumul dépasse la prestation affectée");
        if(current.getStatus()==TransactionStatus.COMPLETED) {
            require(BaitlyRefundSeries.isSeries(current) && before.compareTo(BaitlyRefundSeries.before(current))==0,"Cumul confirmé incohérent");
            batches.validate(current,original); return;
        }
        var mission=batches.lockMission(original.getOrganizationId(),part.getInterventionId());
        var funding=allocations(original.getOrganizationId(),part.getInterventionId());
        require(funding.size()==1 && Objects.equals(funding.getFirst().getTransaction().getId(),original.getId()),
                "Plusieurs lots financent cette prestation");
        require(mission.getPaymentStatus()==(before.signum()==0?PaymentStatus.PAID:PaymentStatus.PARTIALLY_REFUNDED)
                && Objects.equals(mission.getStripeSessionId(),original.getProviderTxId())
                && Objects.equals(mission.getCurrency(),part.getCurrency()) && same(mission.getEstimatedCost(),part.getAmount()),
                "La prestation et son cumul doivent être rapprochés");
        coordination.requireRefundOutsideCancellationCase(original);
        batches.requireLedger(original,part);
        var attempts=payments.findByOrganizationIdAndSourceTypeAndSourceId(original.getOrganizationId(),"INTERVENTION",mission.getId());
        require(attempts.stream().noneMatch(p -> p.getPaymentType()==TransactionType.CHECKOUT && BaitlyCheckoutEvidence.requiresReconciliation(p)),
                "Plusieurs financements doivent être rapprochés");
        if(mission.getServiceRequest()!=null) require(payments.findByOrganizationIdAndSourceTypeAndSourceId(original.getOrganizationId(),"SERVICE_REQUEST",mission.getServiceRequest().getId())
                .stream().noneMatch(BaitlyCheckoutEvidence::requiresReconciliation),"Le financement de la demande liée doit être rapproché");
        long invoices=em.createQuery("select count(i) from Invoice i where i.organizationId=:org and i.interventionId=:mission "
                + "and i.paymentTransactionId is not null and i.paymentTransactionId<>:payment",Long.class)
                .setParameter("org",original.getOrganizationId()).setParameter("mission",mission.getId()).setParameter("payment",original.getId()).getSingleResult();
        require(invoices==0,"La facture est liée à un autre financement");
        var metadata=new HashMap<>(current.getMetadata()); metadata.put("cumulativeRefund",true);
        metadata.put("refundBefore",before.toPlainString()); metadata.put("refundAfter",before.add(current.getAmount()).toPlainString()); current.setMetadata(metadata);
        recoveries.prepareSeriesInterventionRefund(current,part.getAmount().subtract(before));
    }

    private List<InterventionPaymentAllocation> allocations(Long org,Long mission) {
        return em.createQuery("select a from InterventionPaymentAllocation a join fetch a.transaction t where a.organizationId=:org "
                + "and t.organizationId=:org and a.interventionId=:mission and t.status<>com.clenzy.model.TransactionStatus.CANCELLED",InterventionPaymentAllocation.class)
                .setParameter("org",org).setParameter("mission",mission).getResultList();
    }
    private List<PaymentTransaction> rows(PaymentTransaction original) {
        var ids=batches.parts(original).stream().map(InterventionPaymentAllocation::getInterventionId).toList();
        return em.createQuery("select p from PaymentTransaction p where p.organizationId=:org and p.paymentType=com.clenzy.model.TransactionType.REFUND "
                + "and ((p.sourceType='INTERVENTION' and p.sourceId in :ids) or (p.sourceType=:source and p.sourceId=:id)) order by p.id",PaymentTransaction.class)
                .setParameter("org",original.getOrganizationId()).setParameter("ids",ids).setParameter("source",original.getSourceType())
                .setParameter("id",original.getSourceId()).getResultList().stream()
                .filter(p -> p.getRefundParent()==null && p.getMetadata()!=null && original.getTransactionRef().equals(p.getMetadata().get("originalTransactionRef"))).toList();
    }
    private Item item(PaymentTransaction row) { return new Item(row.getTransactionRef(),row.getProviderTxId(),row.getAmount(),row.getCurrency(),
            assigned(row)?row.getSourceId():null,assigned(row) || BaitlyRefundEvidence.distributed(row),BaitlyExternalRefundStore.confirmed(row) && !Boolean.TRUE.equals(row.getMetadata().get("reviewRequired")),
            !assigned(row) && !BaitlyRefundEvidence.distributed(row) && row.getStatus()==TransactionStatus.PROCESSING && "succeeded".equals(row.getMetadata().get("stripeStatus")),
            (assigned(row) || BaitlyRefundEvidence.distributed(row)) && Boolean.TRUE.equals(row.getMetadata().get("reviewRequired")) && row.getMetadata().containsKey("reviewCheckedAt")); }
    private static boolean same(BigDecimal left,BigDecimal right) { return left!=null && right!=null && left.compareTo(right)==0; }
}
