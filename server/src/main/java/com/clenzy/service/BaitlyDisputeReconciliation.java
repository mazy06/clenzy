package com.clenzy.service;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.PaymentDispute;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.*;

/** Le webhook est un signal ; la preuve actuelle est relue dans le compte Stripe de la plateforme. */
@Service
public class BaitlyDisputeReconciliation {
    private final StripeGateway stripe;
    private final PaymentTransactionRepository payments;
    private final BaitlyDisputeStore store;
    private final TenantScopedExecutor tenants;
    private final ActionItemWriter actions;
    private final PropertyRepository properties;
    private final SupervisionSuggestionService suggestions;
    public BaitlyDisputeReconciliation(StripeGateway stripe,PaymentTransactionRepository payments,BaitlyDisputeStore store,
            TenantScopedExecutor tenants,ActionItemWriter actions,PropertyRepository properties,SupervisionSuggestionService suggestions) {
        this.stripe=stripe; this.payments=payments; this.store=store; this.tenants=tenants; this.actions=actions;
        this.properties=properties; this.suggestions=suggestions;
    }
    public void reconcile(String reference) {
        if(TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Litige : réseau sous transaction interdit");
        try {
            var dispute=stripe.retrieveDispute(reference);
            require(dispute!=null && Objects.equals(dispute.getId(),reference) && dispute.getCharge()!=null
                    && dispute.getPaymentIntent()!=null,"Litige Stripe introuvable");
            var charge=stripe.retrieveCharge(dispute.getCharge());
            require(charge!=null && Objects.equals(charge.getId(),dispute.getCharge())
                    && Objects.equals(charge.getPaymentIntent(),dispute.getPaymentIntent()),"Charge du litige incohérente");
            var known=stripe.sessionsForPaymentIntent(dispute.getPaymentIntent()).stream()
                    .filter(s->payments.findByProviderTxId(s.getId()).isPresent()).toList();
            if(known.isEmpty()) return; // Paiement d'un autre produit de la plateforme.
            require(known.size()==1,"Plusieurs paiements Baitly portent ce litige");
            var session=stripe.retrieveSession(known.getFirst().getId());
            var payment=payments.findByProviderTxId(known.getFirst().getId()).orElseThrow();
            var proof=BaitlyDisputeProof.checked(payment,session,charge,dispute);
            tenants.runAsOrganization(proof.org(),()->notify(store.observe(proof)));
        } catch(com.stripe.exception.StripeException failure) {
            throw new IllegalStateException("Lecture du litige Stripe indisponible ; reprise requise");
        }
    }
    private void notify(PaymentDispute dispute) {
        Long org=dispute.getOrganizationId();
        if(!dispute.isFundingHeld()) {
            actions.resolve(org,ActionItemKind.PAYMENT_INCIDENT,dispute.getProviderDisputeId(),"stripe:"+dispute.getOutcome());
            return;
        }
        boolean lost=dispute.getStatus()==PaymentDispute.Status.LOST;
        actions.record(new ActionItemWriter.EventAction(org,ActionItemKind.PAYMENT_INCIDENT,dispute.getProviderDisputeId(),
                "critical",lost?"Litige bancaire perdu":"Paiement contesté auprès de la banque",
                lost?"Le montant contesté reste exclu des reversements. Vérifiez les fonds déjà transférés et les frais Stripe.":
                    "Le paiement est identifié et ses fonds sont bloqués pour les reversements. Consultez le dossier Stripe avant toute décision.",
                dispute.getId(),dispute.getAmount(),dispute.getCurrency(),dispute.getDueBy(),"DISPUTE_OPENED"));
        if(dispute.getStatus()!=PaymentDispute.Status.OPEN && dispute.getStatus()!=PaymentDispute.Status.SUBMITTED) return;
        Long anchor=properties.findFirstPropertyIdByOrg(org);
        if(anchor!=null) suggestions.recordOrgActionable(org,anchor,"fin","Litige bancaire reçu ("+dispute.getProviderDisputeId()+")",
                "Consultez la contestation et les justificatifs avant de soumettre une réponse à Stripe.",
                SupervisionActionType.CHARGEBACK_SUBMIT,"{\"disputeId\":"+dispute.getId()+"}",
                dispute.getAmount().movePointRight(2).longValueExact(),"critical");
    }
    private static void require(boolean ok,String message) { if(!ok) throw new IllegalStateException(message); }
}
