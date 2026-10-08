package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Répare le journal d'un règlement acquis, sans rejouer la mission ni son crédit comptable. */
@Service
public class BaitlyHistoricalCheckoutWriter {
    private final PaymentTransactionRepository payments;
    private final InterventionRepository missions;
    private final InterventionPaymentAllocationRepository allocations;
    private final InterventionPaymentCoordination coordination;
    private final PaymentPersistence persistence;
    private final EntityManager em;

    public BaitlyHistoricalCheckoutWriter(PaymentTransactionRepository payments, InterventionRepository missions,
            InterventionPaymentAllocationRepository allocations, InterventionPaymentCoordination coordination,
            PaymentPersistence persistence, EntityManager em) {
        this.payments=payments; this.missions=missions; this.allocations=allocations;
        this.coordination=coordination; this.persistence=persistence; this.em=em;
    }

    @Transactional
    public void reconcilePaid(String ref, String session, Long orgId, Long sourceId,
            BigDecimal amount, String currency, String intent) {
        var tx=payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(orgId,tx.getOrganizationId()), "Encaissement hors organisation");
        em.refresh(tx,LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(orgId,tx.getOrganizationId()) && Objects.equals(sourceId,tx.getSourceId())
                && "INTERVENTION".equals(tx.getSourceType()) && tx.getPaymentType()==TransactionType.CHECKOUT
                && tx.getProviderType()==PaymentProviderType.STRIPE && Objects.equals(session,tx.getProviderTxId())
                && amount!=null && tx.getAmount()!=null && amount.compareTo(tx.getAmount())==0
                && currency!=null && currency.equalsIgnoreCase(tx.getCurrency()) && intent!=null && intent.startsWith("pi_"),
                "La preuve Stripe ne correspond plus à cet encaissement");
        if(tx.getStatus()!=TransactionStatus.PROCESSING) return;
        require(allocations.findForTransaction(orgId,ref).isEmpty(), "Session partagée : utilisez le suivi du lot");
        var linked=missions.findAllByStripeSessionIdAndOrganizationId(session,orgId);
        require(linked.size()==1 && Objects.equals(sourceId,linked.get(0).getId()), "Session ambiguë");
        var mission=coordination.lockMission(orgId,sourceId);
        // Un paiement nouveau reste traité par le circuit de confirmation habituel.
        if(mission.getPaymentStatus()!=PaymentStatus.PAID) return;
        require(Objects.equals(session,mission.getStripeSessionId()) && mission.getPaidAt()!=null
                && mission.getEstimatedCost()!=null && amount.compareTo(mission.getEstimatedCost())==0
                && tx.getMetadata()!=null && "FULL".equals(tx.getMetadata().get("purpose")),
                "Historique incompatible : rapprochement manuel requis");
        var metadata=new HashMap<>(tx.getMetadata());
        metadata.put("historicalCheckoutVerified",true);
        metadata.put("verifiedPaymentIntent",intent);
        tx.setMetadata(metadata);
        em.flush();
        persistence.completeTransaction(ref);
    }
}
