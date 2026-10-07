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

    @Transactional(readOnly=true)
    public Map<String,Object> status(Long org,String ref) {
        var refund=payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(refund.getOrganizationId(),org) && BaitlyRefundSeries.isSeries(refund),"Remboursement inaccessible");
        Long pairs=em.createQuery("select count(e) from LedgerEntry e where e.organizationId=:org "
                + "and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND and e.referenceId=:ref",Long.class)
                .setParameter("org",org).setParameter("ref",ref).getSingleResult();
        return Map.of("status",refund.getStatus().name(),"reconciled",refund.getStatus()==TransactionStatus.COMPLETED && pairs>0);
    }
}
