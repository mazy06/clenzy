package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.ai.*;
import com.stripe.model.Invoice;
import com.stripe.exception.StripeException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Rapproche les paiements d'échéance, remboursements et mouvements de litige, hors transaction SQL. */
@Service
public class BaitlySubscriptionFunds {
    public record Snapshot(long paid,long refunded,long held,boolean disputed,Instant startedAt) {
        public Snapshot(long paid,long refunded,long held,boolean disputed){this(paid,refunded,held,disputed,Instant.now());}
    }
    private final StripeGateway stripe;
    private final EntityManager em;
    private final BaitlyCreditWallet wallet;
    private final CreditBalanceService balance;
    public BaitlySubscriptionFunds(StripeGateway stripe,EntityManager em,BaitlyCreditWallet wallet,CreditBalanceService balance){this.stripe=stripe;this.em=em;this.wallet=wallet;this.balance=balance;}

    public Snapshot inspect(Invoice invoice)throws StripeException {
        Instant startedAt=Instant.now();
        require(invoice.getAmountPaid()!=null && invoice.getAmountPaid()>=0,"Montant d'échéance absent");
        long paid=0,refunded=0,held=0;boolean risk=false;var seen=new HashSet<String>();
        for(var payment:stripe.invoicePayments(invoice.getId(),null)) {
            if(!"paid".equals(payment.getStatus()))continue;
            require(invoice.getId().equals(payment.getInvoice()) && payment.getAmountPaid()!=null && payment.getAmountPaid()>0
                    && invoice.getCurrency().equals(payment.getCurrency()) && payment.getPayment()!=null,"Paiement d'échéance incohérent");
            var detail=payment.getPayment();String chargeId=detail.getCharge();String intent=detail.getPaymentIntent();
            if(intent!=null) {
                var pi=stripe.retrievePaymentIntent(intent);
                require("succeeded".equals(pi.getStatus()) && Objects.equals(invoice.getCustomer(),pi.getCustomer()),"Encaissement d'échéance incomplet");
                chargeId=pi.getLatestCharge();
            }
            require(chargeId!=null && seen.add(chargeId),"Charge d'échéance absente ou partagée");
            var charge=stripe.retrieveCharge(chargeId);
            require(Boolean.TRUE.equals(charge.getPaid()) && Boolean.TRUE.equals(charge.getCaptured()) && Objects.equals(invoice.getCustomer(),charge.getCustomer())
                    && invoice.getCurrency().equals(charge.getCurrency()) && Objects.equals(payment.getAmountPaid(),charge.getAmount())
                    && Objects.equals(charge.getAmountCaptured(),charge.getAmount()) && charge.getAmountRefunded()!=null,"Charge d'échéance à rapprocher");
            long returned=0,reserved=0;var refundIds=new HashSet<String>();
            for(var refund:stripe.refundsForCharge(chargeId)) {
                require(chargeId.equals(refund.getCharge()) && refund.getId()!=null && refundIds.add(refund.getId()) && refund.getAmount()!=null && refund.getAmount()>0
                        && invoice.getCurrency().equals(refund.getCurrency()),"Remboursement d'échéance incohérent");
                require(Set.of("succeeded","pending","requires_action","failed","canceled").contains(Objects.toString(refund.getStatus(),"")),"État du remboursement inconnu");
                if("succeeded".equals(refund.getStatus()))returned=Math.addExact(returned,refund.getAmount());
                if(!Set.of("failed","canceled").contains(refund.getStatus()))reserved=Math.addExact(reserved,refund.getAmount());
            }
            require(returned==charge.getAmountRefunded() && reserved<=charge.getAmount(),"Total des remboursements incomplet");
            var disputes=stripe.disputesForCharge(chargeId);
            if(Boolean.TRUE.equals(charge.getDisputed()) && disputes.isEmpty())risk=true;
            for(var dispute:disputes) {
                require(chargeId.equals(dispute.getCharge()) && invoice.getCurrency().equals(dispute.getCurrency()),"Litige étranger à l'échéance");
                boolean closed=Set.of("won","warning_closed","prevented").contains(Objects.toString(dispute.getStatus(),""));
                long withdrawn=0;
                for(var movement:dispute.getBalanceTransactions()==null?List.<com.stripe.model.BalanceTransaction>of():dispute.getBalanceTransactions()) {
                    require(invoice.getCurrency().equals(movement.getCurrency()) && movement.getAmount()!=null,"Restitution du litige non prouvée");
                    withdrawn=Math.addExact(withdrawn,movement.getAmount());
                }
                risk|=!closed || withdrawn<0;
            }
            paid=Math.addExact(paid,payment.getAmountPaid());refunded=Math.addExact(refunded,returned);held=Math.addExact(held,reserved);
        }
        require(paid==invoice.getAmountPaid(),"Liste des encaissements d'échéance incomplète");
        return new Snapshot(paid,refunded,held,risk,startedAt);
    }

    @Transactional
    public void apply(Long org,Invoice invoice,Snapshot proof,Instant periodEnd) {
        require(proof!=null && proof.startedAt()!=null,"Preuve des fonds absente");wallet.lock(org);em.flush();
        String sub=BaitlySubscriptionBilling.subscriptionId(invoice);
        var funding=em.find(BaitlySubscriptionFunding.class,invoice.getId());
        if(funding==null){funding=new BaitlySubscriptionFunding(invoice.getId(),org,sub);funding.observe(proof.paid(),proof.refunded(),proof.held(),proof.disputed(),periodEnd,proof.startedAt());em.persist(funding);}
        else em.refresh(funding);
        require(org.equals(funding.getOrganizationId()) && Objects.equals(sub,funding.getSubscriptionId()),"Facture financée par un autre contrat");
        require(funding.getPaidCents()==proof.paid(),"Le montant de la facture payée a changé");
        // Une réponse réseau ancienne ne peut pas défaire le gel plus récent d'un autre worker.
        if(!proof.startedAt().isBefore(funding.getObservedAt()))funding.observe(proof.paid(),proof.refunded(),proof.held(),proof.disputed(),periodEnd,proof.startedAt());
        var coverage=em.find(BaitlyCreditCoverage.class,invoice.getId());if(coverage!=null)coverage.setBlocked(funding.blocked());
        for(var grant:em.createQuery("from AiCreditGrant where organizationId=:org and (fundingInvoiceId=:invoice or stripeRef=:invoice or stripeRef like :monthly)",AiCreditGrant.class)
                .setParameter("org",org).setParameter("invoice",invoice.getId()).setParameter("monthly","monthly:%:"+invoice.getId()).getResultList()) {
            long revoked=funding.revoked(grant.getMillicreditsGranted()),previous=grant.getMillicreditsRevoked();
            if(previous==revoked)continue;grant.setMillicreditsRevoked(revoked);
            em.persist(new AiUsageLedgerEntry(org,null,null,null,"billing","CREDITS",AiUsageLedgerEntry.TYPE_ADJUSTMENT,AiUsageLedgerEntry.BUCKET_INTERACTIVE,
                    null,null,0,0,0,null,null,previous-revoked,0,"subscription-funds:"+invoice.getId()+":"+UUID.randomUUID()));
        }
        balance.invalidate(org);
    }
    @Transactional(readOnly=true)
    public Instant paidUntil(Long org,String sub) {
        return em.createQuery("select max(f.periodEnd) from BaitlySubscriptionFunding f where f.organizationId=:org and f.subscriptionId=:sub and f.disputed=false and (f.paidCents=0 or f.heldCents<f.paidCents)",Instant.class)
                .setParameter("org",org).setParameter("sub",sub).getSingleResult();
    }
    private static void require(boolean ok,String message){if(!ok)throw new IllegalStateException(message);}
}
