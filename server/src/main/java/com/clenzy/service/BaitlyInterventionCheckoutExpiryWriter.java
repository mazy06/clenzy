package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Transaction courte, sans appel PSP et sans réécrire le statut opérationnel de la mission. */
@Service
public class BaitlyInterventionCheckoutExpiryWriter {
    private final PaymentTransactionRepository payments;
    private final InterventionRepository missions;
    private final InterventionPaymentAllocationRepository allocations;
    private final InterventionPaymentCoordination coordination;
    private final InvoicePaymentCoordination invoices;
    private final EntityManager em;
    static boolean retryProven(PaymentTransaction tx) {
        return "INTERVENTION".equals(tx.getSourceType()) && tx.getMetadata()!=null
                && Boolean.TRUE.equals(tx.getMetadata().get("standaloneRetryAllowed"));
    }
    public BaitlyInterventionCheckoutExpiryWriter(PaymentTransactionRepository payments,
            InterventionRepository missions, InterventionPaymentAllocationRepository allocations,
            InterventionPaymentCoordination coordination, InvoicePaymentCoordination invoices, EntityManager em) {
        this.payments=payments; this.missions=missions; this.allocations=allocations;
        this.coordination=coordination; this.invoices=invoices; this.em=em;
    }
    @Transactional
    public boolean expire(String ref, String session, Long orgId) {
        var tx=payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(orgId,tx.getOrganizationId()), "Encaissement hors organisation");
        em.refresh(tx,LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(orgId,tx.getOrganizationId()) && "INTERVENTION".equals(tx.getSourceType())
                && tx.getPaymentType()==TransactionType.CHECKOUT && tx.getProviderType()==PaymentProviderType.STRIPE
                && Objects.equals(session,tx.getProviderTxId()), "Encaissement incohérent");
        if(tx.getStatus()!=TransactionStatus.PROCESSING && tx.getStatus()!=TransactionStatus.FAILED) return false;
        if(tx.getMetadata()!=null && Boolean.TRUE.equals(tx.getMetadata().get("standaloneRetryAllowed"))) return true;
        require(allocations.findForTransaction(orgId,ref).isEmpty(), "Session partagée : utilisez le suivi du lot");
        var linked=missions.findAllByStripeSessionIdAndOrganizationId(session,orgId);
        require(linked.size()==1 && Objects.equals(linked.get(0).getId(),tx.getSourceId()), "Session ambiguë");
        var mission=coordination.lockMission(orgId,tx.getSourceId());
        require(Objects.equals(session,mission.getStripeSessionId()) && mission.getPaymentStatus()==PaymentStatus.PROCESSING
                && mission.getPaidAt()==null,
                "La mission possède déjà un encaissement ou une autre session");
        require(tx.getMetadata()!=null && "FULL".equals(tx.getMetadata().get("purpose")), "Acompte à rapprocher séparément");
        var metadata=new HashMap<>(tx.getMetadata());
        metadata.put("standaloneRetryAllowed",true);
        metadata.put("expiredSessionId",session);
        tx.setMetadata(metadata);
        tx.setStatus(TransactionStatus.FAILED);
        tx.setErrorMessage("Session Stripe expirée, absence d’encaissement vérifiée");
        mission.setStripeSessionId(null);
        mission.setPaymentStatus(PaymentStatus.FAILED);
        invoices.releaseExpiredBindings(tx);
        return true;
    }
}
