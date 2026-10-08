package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Domaine sûr pour les contre-écritures automatiques d'un remboursement externe. */
@Service
@Transactional(propagation=Propagation.MANDATORY)
public class BaitlyExternalRefundEligibility {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentCoordination coordination;
    private final BaitlyBatchRefundPersistence locks;
    private final com.clenzy.service.payout.BaitlyTransferRecoveryStore recoveries;
    public BaitlyExternalRefundEligibility(EntityManager em, PaymentTransactionRepository payments,
            InterventionPaymentCoordination coordination,BaitlyBatchRefundPersistence locks,
            com.clenzy.service.payout.BaitlyTransferRecoveryStore recoveries) {
        this.em=em; this.payments=payments; this.coordination=coordination; this.locks=locks; this.recoveries=recoveries;
    }
    public void requireEligible(PaymentTransaction original, PaymentTransaction refund,List<BaitlyExternalRefundProof> snapshot) {
        require(original.getStatus()==TransactionStatus.COMPLETED && !original.hasDisputeRisk() && "INTERVENTION".equals(original.getSourceType())
                && "EUR".equals(original.getCurrency()) && refund.getAmount().signum()>0
                && original.getAmount().compareTo(refund.getAmount())>=0,
                "Seule une prestation encaissée seule peut être rapprochée automatiquement");
        var mission=locks.lockMission(original.getOrganizationId(),original.getSourceId());
        coordination.requireStandaloneRefundSeries(original);
        var attempts=new ArrayList<>(payments.findByOrganizationIdAndSourceTypeAndSourceId(original.getOrganizationId(),"INTERVENTION",mission.getId()));
        if(mission.getServiceRequest()!=null) attempts.addAll(payments.findByOrganizationIdAndSourceTypeAndSourceId(
                original.getOrganizationId(),"SERVICE_REQUEST",mission.getServiceRequest().getId()));
        require(attempts.stream().allMatch(p -> Objects.equals(p.getId(),original.getId()) || Objects.equals(p.getId(),refund.getId())
                || p.getPaymentType()==TransactionType.REFUND || p.getStatus()==TransactionStatus.CANCELLED
                || p.getPaymentType()==TransactionType.CHECKOUT && "INTERVENTION".equals(p.getSourceType())
                    && Objects.equals(mission.getId(),p.getSourceId()) && BaitlyMaintenanceReceipts.multiple(attempts)),
                "Un autre financement ou remboursement doit être rapproché");
        attempts.forEach(em::refresh);
        var maintenance=BaitlyMaintenanceReceipts.multiple(attempts) ? coordination.maintenanceReceipts(mission,attempts) : null;
        BigDecimal before=BaitlyExternalRefundSeries.before(original,refund,maintenance==null?attempts:BaitlyMaintenanceReceipts.forReceipt(original,attempts),snapshot);
        BigDecimal globalBefore=before;
        if(maintenance!=null) {
            var previous=attempts.stream().filter(p -> p.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)
                    && BaitlyRefundEvidence.order(p)<BaitlyRefundEvidence.order(refund)).toList();
            require(previous.stream().allMatch(p -> p.getStatus()==TransactionStatus.COMPLETED && BaitlyRefundEvidence.confirmedStripe(p)),
                    "Un remboursement antérieur de l'acompte ou du solde doit être rapproché");
            globalBefore=previous.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        }
        require(mission.getPaymentStatus()==(globalBefore.signum()==0?PaymentStatus.PAID:PaymentStatus.PARTIALLY_REFUNDED),
                "Le cumul remboursé de la mission doit être rapproché");
        var metadata=new HashMap<>(refund.getMetadata()); metadata.put("cumulativeRefund",true);
        metadata.put("refundBefore",before.toPlainString()); metadata.put("refundAfter",before.add(refund.getAmount()).toPlainString());
        if(maintenance!=null) { metadata.put("maintenanceRefund",true);metadata.put("maintenanceRefundBefore",globalBefore.toPlainString()); }
        refund.setMetadata(metadata);
        Number conflicting=(Number)em.createNativeQuery("""
            SELECT (SELECT count(*) FROM intervention_payment_allocations WHERE organization_id=:org AND intervention_id=:mission)
                 + (SELECT count(*) FROM invoices WHERE organization_id=:org AND intervention_id=:mission
                       AND payment_transaction_id IS NOT NULL AND payment_transaction_id<>:payment AND :maintenance=false)
            """).setParameter("org",original.getOrganizationId()).setParameter("mission",mission.getId()).setParameter("payment",original.getId())
                .setParameter("maintenance",maintenance!=null).getSingleResult();
        require(conflicting.longValue()==0,"Reversement ou financement partagé à rapprocher");
        var entries=em.createQuery("from LedgerEntry e where e.organizationId=:org and "
                + "((e.referenceType=com.clenzy.model.LedgerReferenceType.PAYMENT and e.referenceId=:payment and e.description like 'Paiement intervention%') "
                + "or (e.referenceType=com.clenzy.model.LedgerReferenceType.SPLIT and e.referenceId=:split))",LedgerEntry.class)
                .setParameter("org",original.getOrganizationId()).setParameter("payment",mission.getId().toString())
                .setParameter("split","SPLIT-INTERVENTION-"+mission.getId()).getResultList();
        BigDecimal receipt=BigDecimal.ZERO,split=BigDecimal.ZERO;
        for(var e:entries) {
            var counterpart=entries.stream().filter(other -> Objects.equals(other.getId(),e.getCounterpartEntryId())).findFirst().orElseThrow();
            require(Objects.equals(counterpart.getCounterpartEntryId(),e.getId()) && counterpart.getEntryType()!=e.getEntryType()
                    && e.getAmount().signum()>0 && e.getAmount().compareTo(counterpart.getAmount())==0
                    && "EUR".equals(e.getCurrency()) && e.getReferenceType()==counterpart.getReferenceType()
                    && Objects.equals(e.getReferenceId(),counterpart.getReferenceId()), "Paire comptable incohérente");
            if(e.getEntryType()==LedgerEntryType.DEBIT) {
                if(e.getReferenceType()==LedgerReferenceType.PAYMENT) receipt=receipt.add(e.getAmount()); else split=split.add(e.getAmount());
            }
        }
        require(receipt.compareTo(maintenance==null?original.getAmount():maintenance.gross())==0 && split.compareTo(receipt)<=0,"Encaissement comptable incomplet");
        long reversals=em.createQuery("select count(e) from LedgerEntry e where e.organizationId=:org "
                + "and e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND and e.referenceId in (:ref,:externalRef)",Long.class)
                .setParameter("org",original.getOrganizationId()).setParameter("ref","REFUND-INTERVENTION-"+mission.getId())
                .setParameter("externalRef",refund.getTransactionRef()).getSingleResult();
        require(reversals==0,"Une contre-écriture historique doit être rapprochée");
        // La preuve du remboursement externe n'autorise pas une nouvelle restitution client.
        // Seule la part du transfert initial est réservée, comme pour une demande depuis Finance.
        recoveries.prepareSeriesInterventionRefund(refund, (maintenance==null?original.getAmount():maintenance.gross()).subtract(globalBefore));
    }
}
