package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Lien canonique, réserve du paiement et mouvements PSP atomiques, sans réseau sous verrou. */
@Service
public class BaitlyDisputeStore {
    private final EntityManager em;
    private final TenantContext tenant;
    private final com.clenzy.service.ai.BaitlyCreditFunding credits;
    public BaitlyDisputeStore(EntityManager em,TenantContext tenant,com.clenzy.service.ai.BaitlyCreditFunding credits) { this.em=em; this.tenant=tenant; this.credits=credits; }
    @Transactional
    public PaymentDispute observe(BaitlyDisputeProof proof) {
        require(Objects.equals(tenant.getRequiredOrganizationId(),proof.org()),"Litige hors organisation");
        var payment=em.find(PaymentTransaction.class,proof.paymentId(),LockModeType.PESSIMISTIC_WRITE);
        require(payment!=null && Objects.equals(payment.getOrganizationId(),proof.org()),"Paiement du litige inaccessible");
        em.refresh(payment,LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(payment.getProviderTxId(),proof.session()) && payment.getProviderType()==PaymentProviderType.STRIPE
                && payment.getPaymentType()==TransactionType.CHECKOUT && payment.getStatus()==TransactionStatus.COMPLETED
                && proof.currency().equals(payment.getCurrency()) && proof.amount().signum()>0
                && proof.amount().compareTo(payment.getAmount())<=0,"Paiement du litige modifié");
        // Même verrou de mission que le remboursement et la réservation d'un transfert prestataire.
        var missionIds=new TreeSet<Long>();
        if("INTERVENTION".equals(payment.getSourceType())) missionIds.add(payment.getSourceId());
        if("SERVICE_REQUEST".equals(payment.getSourceType())) {
            var request=em.find(ServiceRequest.class,payment.getSourceId(),LockModeType.PESSIMISTIC_WRITE);
            require(request!=null && Objects.equals(request.getOrganizationId(),proof.org()),"Demande du litige inaccessible");
            if(request.getConvertedInterventionId()!=null) missionIds.add(request.getConvertedInterventionId());
        }
        missionIds.addAll(em.createQuery("select a.interventionId from InterventionPaymentAllocation a where a.organizationId=:org and a.transaction.id=:payment",Long.class)
                .setParameter("org",proof.org()).setParameter("payment",payment.getId()).getResultList());
        for(Long id:missionIds) {
            var mission=em.find(Intervention.class,id,LockModeType.PESSIMISTIC_WRITE);
            require(mission!=null && Objects.equals(mission.getOrganizationId(),proof.org()),"Mission du litige inaccessible");
        }
        if(com.clenzy.service.payout.ReservationPayoutFunding.SOURCES.contains(Objects.toString(payment.getSourceType(),""))) {
            var stay=em.find(Reservation.class,payment.getSourceId(),LockModeType.PESSIMISTIC_WRITE);
            require(stay!=null && Objects.equals(stay.getOrganizationId(),proof.org()),"Séjour du litige inaccessible");
        }
        var existing=em.createQuery("from PaymentDispute where providerDisputeId=:ref",PaymentDispute.class)
                .setParameter("ref",proof.dispute()).getResultList();
        require(existing.size()<=1,"Litige dupliqué");
        var row=existing.isEmpty()?new PaymentDispute():existing.getFirst();
        if(row.getId()!=null) {
            em.refresh(row,LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(row.getOrganizationId(),proof.org()) && Objects.equals(row.getChargeId(),proof.charge())
                    && (row.getPaymentTransactionId()==null || Objects.equals(row.getPaymentTransactionId(),proof.paymentId()))
                    && row.getAmount()!=null && row.getAmount().compareTo(proof.amount())==0
                    && proof.currency().equalsIgnoreCase(row.getCurrency()),"Un autre paiement porte ce litige");
        }
        row.setOrganizationId(proof.org()); row.setPaymentTransactionId(proof.paymentId());
        row.setProviderDisputeId(proof.dispute()); row.setChargeId(proof.charge()); row.setAmount(proof.amount());
        row.setCurrency(proof.currency()); row.setDueBy(proof.deadline());
        if(com.clenzy.service.payout.ReservationPayoutFunding.SOURCES.contains(Objects.toString(payment.getSourceType(),"")))
            row.setReservationId(payment.getSourceId());
        PaymentDispute.Status next=switch(proof.status()) {
            case "won" -> PaymentDispute.Status.WON;
            case "lost" -> PaymentDispute.Status.LOST;
            case "warning_closed","prevented" -> PaymentDispute.Status.CLOSED;
            default -> row.getStatus()==PaymentDispute.Status.SUBMITTED?PaymentDispute.Status.SUBMITTED:PaymentDispute.Status.OPEN;
        };
        // Deux lectures canoniques concurrentes : une réponse ancienne ne rouvre jamais une issue définitive.
        if(row.getStatus()!=PaymentDispute.Status.WON && row.getStatus()!=PaymentDispute.Status.LOST
                && row.getStatus()!=PaymentDispute.Status.CLOSED) {
            row.setStatus(next); row.setOutcome(proof.status());
            if(Set.of(PaymentDispute.Status.WON,PaymentDispute.Status.LOST,PaymentDispute.Status.CLOSED).contains(next)) row.setOutcomeAt(Instant.now());
        } else require(row.getStatus()==next || next==PaymentDispute.Status.OPEN || next==PaymentDispute.Status.SUBMITTED,
                "Issue définitive du litige contradictoire");
        if(row.getId()==null) em.persist(row);
        for(var movement:proof.movements()) {
            var known=em.find(BaitlyDisputeBalanceEntry.class,movement.reference());
            if(known==null) em.persist(new BaitlyDisputeBalanceEntry(proof,movement));
            else require(known.matches(proof,movement),"Mouvement Stripe déjà lié à un autre dossier");
        }
        em.flush();
        var all=em.createQuery("from PaymentDispute where organizationId=:org and paymentTransactionId=:payment",PaymentDispute.class)
                .setParameter("org",proof.org()).setParameter("payment",payment.getId()).getResultList();
        BigDecimal held=BigDecimal.ZERO;
        for(var dispute:all) {
            BigDecimal principalMovement=em.createQuery("select coalesce(sum(e.amount),0) from BaitlyDisputeBalanceEntry e "
                            +"where e.organizationId=:org and e.disputeId=:dispute",BigDecimal.class)
                    .setParameter("org",proof.org()).setParameter("dispute",dispute.getProviderDisputeId()).getSingleResult();
            long credits=em.createQuery("select count(e) from BaitlyDisputeBalanceEntry e where e.organizationId=:org "
                            +"and e.disputeId=:dispute and e.amount>0",Long.class)
                    .setParameter("org",proof.org()).setParameter("dispute",dispute.getProviderDisputeId()).getSingleResult();
            boolean blocked=!Set.of("won","warning_closed").contains(Objects.toString(dispute.getOutcome(),""))
                    || principalMovement.signum()!=0 || ("won".equals(dispute.getOutcome()) && credits==0);
            dispute.setFundingHeld(blocked);
            if(blocked) held=held.add(dispute.getAmount());
        }
        payment.setDisputedAmount(held.min(payment.getAmount()));
        credits.sync(payment);
        return row;
    }
    private static void require(boolean ok,String message) { if(!ok) throw new IllegalStateException(message); }
}
