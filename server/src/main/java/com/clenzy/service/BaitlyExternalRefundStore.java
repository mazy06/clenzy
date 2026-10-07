package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Une preuve externe durable ne donne jamais l'autorisation d'émettre un remboursement. */
@Service
public class BaitlyExternalRefundStore {
    static final String CANDIDATES_SQL = """
        SELECT id,organization_id,transaction_ref,provider_tx_id FROM payment_transactions
        WHERE id>:after AND provider_type='STRIPE' AND payment_type='REFUND'
          AND metadata->>'externalRefund'='true' AND refund_parent_id IS NULL
          AND (status='PROCESSING' OR metadata->>'reviewRequired'='true')
        ORDER BY id LIMIT 20
        """;
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final TenantContext tenant;
    private final BaitlyExternalRefundEligibility eligibility;
    private final PaymentPersistence persistence;
    private final InterventionRefundReconciliationService reconciliation;
    private final BaitlyExternalReservationRefunds reservationRefunds;
    private final BaitlyExternalBatchRefunds batchRefunds;
    private final com.clenzy.service.ai.BaitlyCreditFunding credits;
    public BaitlyExternalRefundStore(EntityManager em, PaymentTransactionRepository payments, TenantContext tenant,
            BaitlyExternalRefundEligibility eligibility, PaymentPersistence persistence, InterventionRefundReconciliationService reconciliation,
            BaitlyExternalReservationRefunds reservationRefunds, BaitlyExternalBatchRefunds batchRefunds,
            com.clenzy.service.ai.BaitlyCreditFunding credits) {
        this.em=em; this.payments=payments; this.tenant=tenant; this.eligibility=eligibility;
        this.persistence=persistence; this.reconciliation=reconciliation;
        this.reservationRefunds=reservationRefunds;
        this.batchRefunds=batchRefunds;
        this.credits=credits;
    }
    public record Candidate(long id, Long org, String ref, String providerId) {}
    public record State(Long org, String ref, String providerId, java.math.BigDecimal amount, String currency, boolean review) {}
    public static boolean external(PaymentTransaction refund) {
        return refund.getPaymentType()==TransactionType.REFUND && refund.getMetadata()!=null
                && Boolean.TRUE.equals(refund.getMetadata().get("externalRefund"));
    }
    public static boolean confirmed(PaymentTransaction refund) {
        return external(refund) && Boolean.TRUE.equals(refund.getMetadata().get("externalRefundConfirmed"));
    }
    /** Un refus canonique avant toute comptabilisation ne consomme pas le budget client. */
    public static boolean rejectedBeforeAccounting(PaymentTransaction refund) {
        return external(refund) && !confirmed(refund) && refund.getStatus()==TransactionStatus.FAILED
                && Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired"))
                && Set.of("failed","canceled").contains(Objects.toString(refund.getMetadata().get("stripeStatus"),""));
    }
    @Transactional(readOnly=true)
    public List<Candidate> candidates(long after) {
        @SuppressWarnings("unchecked") var rows=(List<Object[]>)em.createNativeQuery(CANDIDATES_SQL).setParameter("after",after).getResultList();
        return rows.stream().map(r -> new Candidate(((Number)r[0]).longValue(),((Number)r[1]).longValue(),(String)r[2],(String)r[3])).toList();
    }
    @Transactional
    public State observe(BaitlyExternalRefundProof proof) {
        var original=lockOriginal(proof);
        // La préparation du transfert relit les preuves sous ce même verrou de mission.
        // Une observation arrivée après sa réservation reste un incident à rapprocher.
        if ("INTERVENTION".equals(original.getSourceType())) {
            var mission=em.find(Intervention.class,original.getSourceId());
            require(mission!=null && Objects.equals(mission.getOrganizationId(),original.getOrganizationId()),"Mission hors organisation");
            em.refresh(mission,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        }
        var refund=payments.findByProviderTxId(proof.refundId()).orElse(null);
        if(refund==null) {
            refund=new PaymentTransaction(); refund.setOrganizationId(proof.org());
            refund.setTransactionRef("EXT-"+proof.refundId()); refund.setIdempotencyKey("EXTERNAL-"+proof.refundId());
            refund.setPaymentType(TransactionType.REFUND); refund.setProviderType(PaymentProviderType.STRIPE);
            refund.setProviderTxId(proof.refundId()); refund.setSourceType(proof.source()); refund.setSourceId(proof.sourceId());
            refund.setAmount(proof.amount()); refund.setCurrency(proof.currency());
            refund.setMetadata(Map.of("externalRefund",true,"originalTransactionRef",original.getTransactionRef()));
            payments.save(refund);
        } else {
            require(external(refund),"Une autre décision utilise cette preuve Stripe");
            refund=payments.lockByReference(proof.org(),refund.getTransactionRef()).orElseThrow(); em.refresh(refund);
            require(Objects.equals(proof.originalRef(),refund.getMetadata().get("originalTransactionRef"))
                    && proof.amount().compareTo(refund.getAmount())==0 && proof.currency().equals(refund.getCurrency())
                    && ((proof.source().equals(refund.getSourceType()) && proof.sourceId().equals(refund.getSourceId()))
                        || (BaitlyExternalBatchRefunds.assigned(refund) && "INTERVENTION_BATCH".equals(proof.source())
                            && proof.source().equals(refund.getMetadata().get("originalSourceType"))
                            && proof.sourceId().toString().equals(refund.getMetadata().get("originalSourceId")))),
                    "Preuve externe liée à un autre dossier");
        }
        boolean alreadyConfirmed=refund.getStatus()==TransactionStatus.COMPLETED;
        // Même un rejeu confirmé reste bloquant jusqu'à la relecture complète de la charge.
        // Une erreur réseau ne doit jamais effacer un incident précédemment détecté.
        boolean review=alreadyConfirmed || !proof.rejected();
        if(!alreadyConfirmed) refund.setStatus(proof.rejected()?TransactionStatus.FAILED:TransactionStatus.PROCESSING);
        var metadata=new HashMap<>(refund.getMetadata()); metadata.put("stripeStatus",proof.stripeStatus());
        metadata.put("paymentIntent",proof.intent()); metadata.put("reviewRequired",review);
        refund.setMetadata(metadata);
        refund.setErrorMessage(review?"Remboursement externe Stripe : rapprochement requis":null);
        credits.sync(original);
        return state(refund);
    }
    /** Tous les effets locaux sont atomiques, sous le verrou de l'encaissement puis de la mission. */
    @Transactional
    public State complete(BaitlyExternalRefundProof proof) {
        return complete(proof,List.of(proof));
    }
    @Transactional(readOnly=true)
    public List<BaitlyExternalRefundProof> orderedExternal(List<BaitlyExternalRefundProof> proofs) {
        return proofs.stream().filter(p -> payments.findByProviderTxId(p.refundId()).map(BaitlyExternalRefundStore::external).orElse(false))
                .sorted(Comparator.comparing(p -> payments.findByProviderTxId(p.refundId()).orElseThrow().getId())).toList();
    }
    @Transactional
    public State complete(BaitlyExternalRefundProof proof,List<BaitlyExternalRefundProof> snapshot) {
        var original=lockOriginal(proof);
        var refund=payments.findByProviderTxId(proof.refundId()).orElseThrow();
        require(external(refund) && Objects.equals(refund.getOrganizationId(),proof.org()),"Preuve externe inaccessible");
        refund=payments.lockByReference(proof.org(),refund.getTransactionRef()).orElseThrow(); em.refresh(refund);
        require("succeeded".equals(proof.stripeStatus()) && "succeeded".equals(refund.getMetadata().get("stripeStatus"))
                && proof.originalRef().equals(refund.getMetadata().get("originalTransactionRef"))
                && proof.amount().compareTo(refund.getAmount())==0, "Remboursement externe non confirmé");
        boolean batch="INTERVENTION_BATCH".equals(original.getSourceType());
        if (BaitlyCommerceRefunds.supports(original.getSourceType())) {
            require(original.getStatus()==TransactionStatus.COMPLETED,"Pack non encaissé");
            var related=payments.findByOrganizationIdAndSourceTypeAndSourceId(proof.org(),proof.source(),proof.sourceId()).stream()
                    .filter(p -> p.getMetadata()!=null && proof.originalRef().equals(p.getMetadata().get("originalTransactionRef"))).toList();
            var before=BaitlyExternalRefundSeries.before(original,refund,related,snapshot);
            var metadata=new HashMap<>(refund.getMetadata()); metadata.put("externalRefundConfirmed",true); metadata.put("reviewRequired",false);
            metadata.put("cumulativeRefund",true);metadata.put("refundBefore",before.toPlainString());metadata.put("refundAfter",before.add(refund.getAmount()).toPlainString());
            refund.setMetadata(metadata); refund.setErrorMessage(null);
            persistence.finalizeRefund(refund.getTransactionRef(),PaymentResult.success(proof.refundId(),null,"REFUNDED"),proof.org());
            credits.sync(original);
            return state(refund);
        }
        if(batch) batchRefunds.reconcile(original,refund,snapshot);
        if(batch && BaitlyRefundEvidence.distributed(refund)) {
            var metadata=new HashMap<>(refund.getMetadata()); metadata.put("externalRefundConfirmed",true); metadata.put("reviewRequired",false);
            refund.setMetadata(metadata); refund.setErrorMessage(null);
            persistence.finalizeRefund(refund.getTransactionRef(),PaymentResult.success(proof.refundId(),null,"REFUNDED"),proof.org());
            for(var child:batchRefunds.children(refund)) {
                batchRefunds.reconcilePart(original,child);
                var childMetadata=new HashMap<>(child.getMetadata()); childMetadata.put("externalRefundConfirmed",true); childMetadata.put("reviewRequired",false);
                child.setMetadata(childMetadata); child.setErrorMessage(null);
                persistence.finalizeRefund(child.getTransactionRef(),PaymentResult.success(null,null,"REFUNDED"),proof.org());
                reconciliation.reconcile(child.getTransactionRef());
            }
            return state(refund);
        }
        if(refund.getStatus()==TransactionStatus.COMPLETED) {
            require(original.getStatus()==TransactionStatus.COMPLETED && !original.hasDisputeRisk(),"Encaissement à rapprocher");
            var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(proof.org(),proof.source(),proof.sourceId());
            rows.forEach(em::refresh);
            if(!batch) BaitlyExternalRefundSeries.before(original,refund,rows,snapshot);
            var metadata=new HashMap<>(refund.getMetadata()); metadata.put("reviewRequired",false);
            refund.setMetadata(metadata); refund.setErrorMessage(null); return state(refund);
        }
        if("RESERVATION".equals(original.getSourceType())) reservationRefunds.reconcile(original,refund,snapshot);
        else if(!batch) eligibility.requireEligible(original,refund,snapshot);
        var metadata=new HashMap<>(refund.getMetadata()); metadata.put("externalRefundConfirmed",true); metadata.put("reviewRequired",false);
        refund.setMetadata(metadata); refund.setErrorMessage(null);
        persistence.finalizeRefund(refund.getTransactionRef(),PaymentResult.success(proof.refundId(),null,"REFUNDED"),proof.org());
        if("INTERVENTION".equals(refund.getSourceType())) reconciliation.reconcile(refund.getTransactionRef());
        return state(refund);
    }
    @Transactional
    public State review(String ref) {
        var refund=payments.lockByReference(tenant.getRequiredOrganizationId(),ref).orElseThrow(); em.refresh(refund);
        require(external(refund),"Décision non externe");
        var metadata=new HashMap<>(refund.getMetadata()); metadata.put("reviewRequired",true);
        metadata.put("reviewCheckedAt",LocalDateTime.now().toString()); refund.setMetadata(metadata);
        refund.setErrorMessage("Remboursement externe Stripe : rapprochement requis"); return state(refund);
    }
    private PaymentTransaction lockOriginal(BaitlyExternalRefundProof proof) {
        require(Objects.equals(tenant.getRequiredOrganizationId(),proof.org()),"Preuve hors organisation");
        if("RESERVATION".equals(proof.source())) {
            var stay=em.find(Reservation.class,proof.sourceId());
            require(stay!=null && Objects.equals(stay.getOrganizationId(),proof.org()),"Séjour hors organisation");
            em.refresh(stay,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        }
        var original=payments.lockByReference(proof.org(),proof.originalRef()).orElseThrow(); em.refresh(original);
        proof.requireOriginal(original); return original;
    }
    private State state(PaymentTransaction refund) {
        return new State(refund.getOrganizationId(),refund.getTransactionRef(),refund.getProviderTxId(),refund.getAmount(),
                refund.getCurrency(),Boolean.TRUE.equals(refund.getMetadata().get("reviewRequired")));
    }
}
