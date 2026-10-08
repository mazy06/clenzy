package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Une décision par intention utilisateur, sous le verrou du paiement puis de la mission. */
@Service
public class BaitlyRefundSeriesStore {
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentCoordination coordination;
    private final EntityManager em;
    private final BaitlyTransferRecoveryStore recoveries;
    private final BaitlyBatchRefundPersistence batchRefunds;
    public BaitlyRefundSeriesStore(PaymentTransactionRepository payments, InterventionPaymentCoordination coordination,
            EntityManager em, BaitlyTransferRecoveryStore recoveries, BaitlyBatchRefundPersistence batchRefunds) {
        this.payments=payments; this.coordination=coordination; this.em=em; this.recoveries=recoveries;
        this.batchRefunds=batchRefunds;
    }

    @Transactional
    public String prepare(Long org, Long missionId, BigDecimal amount, UUID requestId) {
        require(requestId!=null && amount!=null && amount.signum()>0 && amount.scale()<=2,"Montant ou identifiant de demande invalide");
        var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",missionId);
        var receipts=rows.stream().filter(p -> p.getPaymentType()==TransactionType.CHECKOUT
                && BaitlyCheckoutEvidence.requiresReconciliation(p)).toList();
        if (receipts.isEmpty()) return batchRefunds.prepareInstallment(org,missionId,amount,requestId);
        if(receipts.size()==2 && receipts.stream().anyMatch(DepositReconciler::isDeposit))
            return prepareMaintenance(org,missionId,amount,requestId,receipts);
        require(receipts.size()==1,"L'encaissement unique de cette prestation doit être rapproché");
        var original=payments.lockByReference(org,receipts.getFirst().getTransactionRef()).orElseThrow();
        em.refresh(original);
        require(original.getStatus()==TransactionStatus.COMPLETED && original.getProviderType()==PaymentProviderType.STRIPE
                && Objects.equals(org,original.getOrganizationId()) && Objects.equals(missionId,original.getSourceId()) && "INTERVENTION".equals(original.getSourceType())
                && "EUR".equals(original.getCurrency()) && original.getAmount()!=null && original.getAmount().signum()>0
                && original.getProviderTxId()!=null && original.getProviderTxId().startsWith("cs_")
                && !original.hasDisputeRisk(),"Encaissement Stripe absent, contesté ou à rapprocher");
        var mission=coordination.lockMission(org,missionId);
        var refreshed=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",missionId);
        refreshed.forEach(em::refresh);
        var history=BaitlyRefundSeries.history(original,refreshed);
        for(var previous:history) {
            em.refresh(previous);
            if(requestId.toString().equals(previous.getMetadata().get("refundRequestId"))) {
                require(BaitlyRefundSeries.isSeries(previous) && previous.getAmount().compareTo(amount)==0,
                        "Cette demande existe déjà avec un autre montant");
                return previous.getTransactionRef();
            }
        }
        require(history.stream().allMatch(p -> p.getStatus()==TransactionStatus.COMPLETED
                && p.getProviderTxId()!=null && p.getProviderTxId().startsWith("re_")),
                "Un remboursement est encore en cours ou à rapprocher");
        BigDecimal before=history.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(before.add(amount).compareTo(original.getAmount())<=0,"Le montant dépasse le solde remboursable");
        require(mission.getPaymentStatus()==(before.signum()==0?PaymentStatus.PAID:PaymentStatus.PARTIALLY_REFUNDED),
                "Le remboursement précédent doit être rapproché avant de poursuivre");
        coordination.requireStandaloneRefundSeries(original);
        var refund=new PaymentTransaction(); refund.setOrganizationId(org); refund.setTransactionRef("REF-"+UUID.randomUUID());
        refund.setProviderType(PaymentProviderType.STRIPE); refund.setPaymentType(TransactionType.REFUND);
        refund.setStatus(TransactionStatus.PROCESSING); refund.setAmount(amount); refund.setCurrency(original.getCurrency());
        refund.setSourceType("INTERVENTION"); refund.setSourceId(missionId);
        refund.setIdempotencyKey("REFUND-"+org+"-"+original.getId()+"-"+requestId);
        refund.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"originalTransactionRef",original.getTransactionRef(),
                "refundRequestId",requestId.toString(),"refundBefore",before.toPlainString(),"refundAfter",before.add(amount).toPlainString()));
        payments.saveAndFlush(refund);
        recoveries.prepareSeriesInterventionRefund(refund,original.getAmount().subtract(before));
        return refund.getTransactionRef();
    }

    private String prepareMaintenance(Long org,Long missionId,BigDecimal amount,UUID requestId,List<PaymentTransaction> receipts) {
        receipts.stream().sorted(Comparator.comparing(PaymentTransaction::getTransactionRef)).forEach(p ->
                em.refresh(payments.lockByReference(org,p.getTransactionRef()).orElseThrow()));
        var mission=coordination.lockMission(org,missionId);
        var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",missionId); rows.forEach(em::refresh);
        var funding=coordination.maintenanceReceipts(mission,rows);var history=funding.history(rows);
        var same=history.stream().filter(p -> requestId.toString().equals(p.getMetadata().get("maintenanceGroup"))).toList();
        if(!same.isEmpty()) {
            require(same.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(amount)==0,
                    "Cette demande existe avec un autre montant");
            return same.getFirst().getTransactionRef();
        }
        require(history.stream().allMatch(p -> p.getStatus()==TransactionStatus.COMPLETED && BaitlyRefundEvidence.confirmedStripe(p)),
                "Un remboursement précédent attend sa confirmation");
        var before=history.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(before.add(amount).compareTo(funding.gross())<=0,"Le montant dépasse le solde remboursable");
        for(var receipt:funding.receipts()) coordination.requireStandaloneRefundSeries(receipt);
        BigDecimal remaining=amount,globalBefore=before;String first=null;
        for(var receipt:funding.receipts()) {
            var prior=BaitlyRefundSeries.history(receipt,BaitlyMaintenanceReceipts.forReceipt(receipt,rows));
            var paidBack=prior.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            var part=remaining.min(receipt.getAmount().subtract(paidBack));if(part.signum()==0) continue;
            var refund=new PaymentTransaction();refund.setOrganizationId(org);refund.setTransactionRef("REF-"+UUID.randomUUID());
            refund.setProviderType(PaymentProviderType.STRIPE);refund.setPaymentType(TransactionType.REFUND);
            refund.setStatus(TransactionStatus.PROCESSING);refund.setAmount(part);refund.setCurrency(receipt.getCurrency());
            refund.setSourceType("INTERVENTION");refund.setSourceId(missionId);
            refund.setIdempotencyKey("REFUND-"+org+"-"+receipt.getId()+"-"+requestId);
            var metadata=new HashMap<String,Object>();metadata.put("managedRefund",true);metadata.put("cumulativeRefund",true);
            metadata.put("originalTransactionRef",receipt.getTransactionRef());metadata.put("refundRequestId",requestId.toString());
            metadata.put("refundBefore",paidBack.toPlainString());metadata.put("refundAfter",paidBack.add(part).toPlainString());
            metadata.put("maintenanceRefund",true);metadata.put("maintenanceRefundBefore",globalBefore.toPlainString());
            metadata.put("maintenanceGroup",requestId.toString());metadata.put("maintenanceGroupAmount",amount.toPlainString());
            refund.setMetadata(metadata);payments.saveAndFlush(refund);
            if(first==null) first=refund.getTransactionRef();remaining=remaining.subtract(part);globalBefore=globalBefore.add(part);
        }
        require(remaining.signum()==0 && first!=null,"Répartition du remboursement incomplète");return first;
    }

    /** Une seule restitution sort à la fois ; la suivante attend aussi les contre-écritures précédentes. */
    @Transactional
    public boolean prepareMaintenanceRecovery(PaymentTransaction candidate) {
        if(!BaitlyMaintenanceReceipts.aggregated(candidate)) return true;
        var mission=coordination.lockMission(candidate.getOrganizationId(),candidate.getSourceId());
        var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(candidate.getOrganizationId(),"INTERVENTION",candidate.getSourceId());
        rows.forEach(em::refresh);var funding=coordination.maintenanceReceipts(mission,rows);
        var history=funding.history(rows);var previous=history.stream().filter(p -> BaitlyRefundEvidence.order(p)<BaitlyRefundEvidence.order(candidate)).toList();
        if(previous.stream().anyMatch(p -> p.getStatus()!=TransactionStatus.COMPLETED)) return false;
        var before=previous.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(before.compareTo(BaitlyMaintenanceReceipts.before(candidate))==0,"Cumul de maintenance à rapprocher");
        for(var prior:previous) {
            Long pairs=em.createQuery("select count(e) from LedgerEntry e where e.organizationId=:org and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND and e.referenceId=:ref",Long.class)
                    .setParameter("org",candidate.getOrganizationId()).setParameter("ref",prior.getTransactionRef()).getSingleResult();
            if(pairs==0) return false;
        }
        recoveries.prepareSeriesInterventionRefund(candidate,funding.gross().subtract(before));return true;
    }

    @Transactional(readOnly=true)
    public Map<String,Object> status(Long org,String ref) {
        var refund=payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(refund.getOrganizationId(),org) && BaitlyRefundSeries.isSeries(refund),"Remboursement inaccessible");
        if(BaitlyMaintenanceReceipts.aggregated(refund) && refund.getMetadata().containsKey("maintenanceGroup")) {
            var group=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,refund.getSourceType(),refund.getSourceId()).stream()
                    .filter(p -> BaitlyMaintenanceReceipts.aggregated(p) && Objects.equals(refund.getMetadata().get("maintenanceGroup"),p.getMetadata().get("maintenanceGroup"))).toList();
            boolean completed=group.stream().allMatch(p -> p.getStatus()==TransactionStatus.COMPLETED);
            boolean reconciled=completed && group.stream().allMatch(p -> em.createQuery("select count(e) from LedgerEntry e where e.organizationId=:org and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND and e.referenceId=:ref",Long.class)
                    .setParameter("org",org).setParameter("ref",p.getTransactionRef()).getSingleResult()>0);
            return Map.of("status",completed?"COMPLETED":"PROCESSING","reconciled",reconciled);
        }
        Long pairs=em.createQuery("select count(e) from LedgerEntry e where e.organizationId=:org "
                + "and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND and e.referenceId=:ref",Long.class)
                .setParameter("org",org).setParameter("ref",ref).getSingleResult();
        return Map.of("status",refund.getStatus().name(),"reconciled",refund.getStatus()==TransactionStatus.COMPLETED && pairs>0);
    }
}
