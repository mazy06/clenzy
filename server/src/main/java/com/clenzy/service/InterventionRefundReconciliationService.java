package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/** Réconcilie un remboursement confirmé et ses écritures Baitly, sans nouvel appel PSP. */
@Service
public class InterventionRefundReconciliationService {
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentCoordination coordination;
    private final PaymentStatusTransitionService transitions;
    private final PaymentLedgerReversalService ledger;
    private final TenantContext tenant;
    private final BaitlyBatchRefundPersistence batchRefunds;

    public InterventionRefundReconciliationService(PaymentTransactionRepository payments,
            InterventionPaymentCoordination coordination, PaymentStatusTransitionService transitions,
            PaymentLedgerReversalService ledger, TenantContext tenant, BaitlyBatchRefundPersistence batchRefunds) {
        this.batchRefunds = batchRefunds;
        this.payments = payments;
        this.coordination = coordination;
        this.transitions = transitions;
        this.ledger = ledger;
        this.tenant = tenant;
    }

    @Transactional
    public void reconcile(String refundRef) {
        var refund = payments.findByTransactionRef(refundRef).orElseThrow();
        if (refund.getStatus() != TransactionStatus.COMPLETED
                || refund.getPaymentType() != TransactionType.REFUND
                || !"INTERVENTION".equals(refund.getSourceType())) return;
        Long orgId = tenant.getRequiredOrganizationId();
        require(Objects.equals(orgId, refund.getOrganizationId()), "Organisation du remboursement incohérente");
        Object originalRef = refund.getMetadata() == null ? null : refund.getMetadata().get("originalTransactionRef");
        require(originalRef instanceof String, "Paiement d'origine du remboursement introuvable");
        var original = payments.findByTransactionRef((String) originalRef).orElseThrow();
        boolean allocated = BaitlyBatchRefundPersistence.isAllocation(refund);
        boolean series = BaitlyRefundSeries.isSeries(refund);
        if (allocated || series) {
            original = payments.lockByReference(orgId, (String) originalRef).orElseThrow();
            if(allocated) batchRefunds.validate(refund, original);
        }
        require(original.getStatus() == TransactionStatus.COMPLETED
                && original.getPaymentType() == TransactionType.CHECKOUT
                && Objects.equals(orgId, original.getOrganizationId())
                && (allocated || (Objects.equals(refund.getSourceType(), original.getSourceType())
                    && Objects.equals(refund.getSourceId(), original.getSourceId())))
                && Objects.equals(refund.getCurrency(), original.getCurrency())
                && refund.getProviderType() == original.getProviderType(), "Remboursement et encaissement incohérents");

        if(series) {
            var part=allocated ? batchRefunds.validate(refund,original) : null;
            var budget=allocated ? part.getAmount() : original.getAmount();
            var mission=allocated ? batchRefunds.lockMission(orgId,refund.getSourceId()) : coordination.lockMission(orgId,refund.getSourceId());
            require((mission.getPaymentStatus()==PaymentStatus.PAID || mission.getPaymentStatus()==PaymentStatus.PARTIALLY_REFUNDED
                    || mission.getPaymentStatus()==PaymentStatus.REFUNDED)
                    && Objects.equals(mission.getStripeSessionId(),original.getProviderTxId())
                    && Objects.equals(mission.getCurrency(),original.getCurrency())
                    && mission.getEstimatedCost()!=null && mission.getEstimatedCost().compareTo(budget)==0,
                    "Encaissement de la restitution à rapprocher");
            var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(orgId,"INTERVENTION",mission.getId());
            // Les observations externes suivantes restent bloquantes pour les nouvelles sorties,
            // mais n'empêchent pas de comptabiliser le préfixe déjà vérifié sous verrou.
            if(BaitlyExternalRefundStore.confirmed(refund)) rows=rows.stream().filter(p -> BaitlyRefundEvidence.order(p)<=BaitlyRefundEvidence.order(refund)).toList();
            var history=allocated ? batchRefunds.history(original,part,rows) : BaitlyRefundSeries.history(original,rows);
            var previous=history.stream().filter(p -> BaitlyRefundEvidence.order(p)<BaitlyRefundEvidence.order(refund)).toList();
            require(previous.stream().allMatch(p -> p.getStatus()==TransactionStatus.COMPLETED)
                    && previous.stream().map(PaymentTransaction::getAmount).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add)
                        .compareTo(BaitlyRefundSeries.before(refund))==0,"Cumul antérieur non confirmé");
            var refs=previous.stream().map(PaymentTransaction::getTransactionRef).toList();
            if(allocated) ledger.reverseCumulativeAllocatedPaymentEntries(original,refund,mission.getId(),budget,refs);
            else ledger.reverseCumulativePaymentEntries(original,refund,mission.getId(),refs);
            var status=BaitlyRefundSeries.after(refund).compareTo(budget)==0
                    || mission.getPaymentStatus()==PaymentStatus.REFUNDED ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
            mission.setPaymentStatus(status);
            if(mission.getServiceRequest()!=null) {
                require(Objects.equals(orgId,mission.getServiceRequest().getOrganizationId()),"Demande hors organisation");
                mission.getServiceRequest().setPaymentStatus(status);
            }
            return;
        }

        // Une restitution partielle ne doit pas afficher la mission intégralement remboursée.
        if (!allocated && refund.getAmount().compareTo(original.getAmount()) != 0) {
            if (!BaitlyExternalRefundStore.confirmed(refund)) return;
            require("succeeded".equals(refund.getMetadata().get("stripeStatus"))
                    && Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired"))
                    && refund.getAmount().signum()>0 && refund.getAmount().compareTo(original.getAmount())<0,
                    "Remboursement partiel externe à rapprocher");
            var mission = batchRefunds.lockMission(orgId, refund.getSourceId());
            require((mission.getPaymentStatus()==PaymentStatus.PAID || mission.getPaymentStatus()==PaymentStatus.PARTIALLY_REFUNDED)
                    && Objects.equals(mission.getStripeSessionId(),original.getProviderTxId())
                    && Objects.equals(mission.getCurrency(),original.getCurrency())
                    && mission.getEstimatedCost()!=null && mission.getEstimatedCost().compareTo(original.getAmount())==0,
                    "Encaissement de l'intervention à rapprocher");
            ledger.reversePartialExternalPaymentEntries(original,refund,mission.getId());
            mission.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            if(mission.getServiceRequest()!=null) {
                require(Objects.equals(orgId,mission.getServiceRequest().getOrganizationId()),"Demande de service hors organisation");
                mission.getServiceRequest().setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            }
            return;
        }
        var mission = allocated ? batchRefunds.lockMission(orgId, refund.getSourceId()) : coordination.lockMission(orgId, refund.getSourceId());
        require(mission.getEstimatedCost() != null && refund.getAmount().compareTo(mission.getEstimatedCost()) == 0,
            "Paiement partiel de mission : rapprochement requis");
        if (original.getProviderType() == PaymentProviderType.STRIPE) {
            require(Objects.equals(mission.getStripeSessionId(), original.getProviderTxId()),
                "La session courante de la mission ne correspond pas au remboursement");
        }
        // Même transaction : un échec du ledger relance l'événement sans renvoyer le remboursement.
        transitions.markInterventionRefunded(mission.getId());
        if (allocated) ledger.reverseAllocatedPaymentEntries(original, refund, mission.getId());
        else ledger.reverseInterventionPaymentEntries(mission.getId());
        if (mission.getServiceRequest() != null) {
            require(Objects.equals(orgId, mission.getServiceRequest().getOrganizationId()), "Demande de service hors organisation");
            mission.getServiceRequest().setPaymentStatus(PaymentStatus.REFUNDED);
        }
    }

    private static void require(boolean valid, String message) {
        if (!valid) throw new IllegalStateException(message);
    }
}
