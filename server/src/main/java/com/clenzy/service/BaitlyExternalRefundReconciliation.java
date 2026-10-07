package com.clenzy.service;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.Refund;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Relecture seule du PSP : ce service ne peut jamais appeler createRefund. */
@Service
public class BaitlyExternalRefundReconciliation {
    private final StripeGateway stripe;
    private final PaymentTransactionRepository payments;
    private final BaitlyExternalRefundStore store;
    private final TenantScopedExecutor tenants;
    private final ActionItemWriter actions;
    private long cursor;
    public BaitlyExternalRefundReconciliation(StripeGateway stripe,PaymentTransactionRepository payments,
            BaitlyExternalRefundStore store,TenantScopedExecutor tenants,ActionItemWriter actions) {
        this.stripe=stripe; this.payments=payments; this.store=store; this.tenants=tenants; this.actions=actions;
    }
    public void onWebhook(Refund incoming) throws com.stripe.exception.StripeException {
        require(incoming!=null && incoming.getId()!=null,"Remboursement absent");
        reconcile(incoming.getId());
    }
    void reconcile(String refundId) throws com.stripe.exception.StripeException {
        var refund=stripe.retrieveRefund(refundId);
        require(refund!=null && refundId.equals(refund.getId()) && refund.getPaymentIntent()!=null,"Preuve Stripe absente");
        // Un dossier géré inconnu doit être repris par son propre circuit, jamais importé comme externe.
        if(managed(refund)) return;
        var sessions=stripe.sessionsForPaymentIntent(refund.getPaymentIntent());
        var known=sessions.stream().filter(s -> payments.findByProviderTxId(s.getId()).isPresent()).toList();
        if(known.isEmpty()) return; // Autre produit Stripe de la plateforme.
        require(known.size()==1,"Plusieurs paiements Baitly utilisent ce PaymentIntent");
        var session=known.getFirst();
        var original=payments.findByProviderTxId(session.getId()).orElseThrow();
        var proof=BaitlyExternalRefundProof.checked(original,session,refund);
        tenants.runAsOrganization(proof.org(), () -> signal(store.observe(proof)));
        if(!"succeeded".equals(proof.stripeStatus())) return;
        // Tous les remboursements actifs doivent être confirmés et appartenir à la même charge.
        var active=stripe.listPaymentRefunds(proof.intent()).stream()
                .filter(r -> !Set.of("failed","canceled").contains(Objects.toString(r.getStatus(),""))).toList();
        if(active.isEmpty() || active.stream().anyMatch(r -> !"succeeded".equals(r.getStatus()))) return;
        var snapshot=active.stream().map(r -> BaitlyExternalRefundProof.checked(original,session,r)).toList();
        require(snapshot.stream().filter(p -> p.equals(proof)).count()==1
                && snapshot.stream().map(BaitlyExternalRefundProof::refundId).distinct().count()==snapshot.size()
                && active.stream().allMatch(r -> Objects.equals(r.getCharge(),refund.getCharge())),
                "Photographie des remboursements Stripe incohérente");
        var total=snapshot.stream().map(BaitlyExternalRefundProof::amount).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add);
        require(total.compareTo(original.getAmount())<=0,"Cumul Stripe supérieur à l'encaissement");
        var charge=refund.getCharge()==null ? null : stripe.retrieveCharge(refund.getCharge());
        require(charge!=null && Objects.equals(charge.getId(),refund.getCharge()) && Boolean.TRUE.equals(charge.getPaid())
                && proof.intent().equals(charge.getPaymentIntent()) && Objects.equals(charge.getCurrency(),"eur")
                && Objects.equals(charge.getAmount(),session.getAmountTotal())
                && Objects.equals(charge.getAmountRefunded(),total.movePointRight(2).longValueExact()),"Charge remboursée incohérente");
        for(int i=0;i<active.size();i++) {
            var next=snapshot.get(i);
            if(!next.refundId().equals(proof.refundId()) && !managed(active.get(i)))
                tenants.runAsOrganization(proof.org(), () -> signal(store.observe(next)));
        }
        // L'ordre local est durable, même si les webhooks arrivent dans le désordre.
        for(var next:store.orderedExternal(snapshot)) tenants.runAsOrganization(proof.org(), () -> {
                BaitlyExternalRefundStore.State state;
                try { state=store.complete(next,snapshot); }
                catch(RuntimeException failure) { state=store.review("EXT-"+next.refundId()); }
                signal(state);
            });
    }
    private static boolean managed(Refund refund) {
        var metadata=refund.getMetadata();
        return metadata!=null && (metadata.containsKey("baitly_refund_ref") || metadata.containsKey("baitly_financial_decision"));
    }
    @Scheduled(initialDelayString="${baitly.payments.external-refund-check-ms:60000}",fixedDelayString="${baitly.payments.external-refund-check-ms:60000}")
    @SchedulerLock(name="baitly-external-refunds",lockAtMostFor="PT10M")
    public void resume() {
        var candidates=store.candidates(cursor);
        if(candidates.isEmpty()) { cursor=0; return; }
        for(var candidate:candidates) {
            try { reconcile(candidate.providerId()); }
            catch(Exception failure) { tenants.runAsOrganization(candidate.org(), () -> signal(store.review(candidate.ref()))); }
            cursor=candidate.id();
        }
    }
    private void signal(BaitlyExternalRefundStore.State state) {
        if(state.review()) actions.record(new ActionItemWriter.EventAction(state.org(),ActionItemKind.PAYMENT_INCIDENT,
                state.providerId(),"warning","Remboursement Stripe à rapprocher",
                "Un remboursement effectué directement dans Stripe concerne ce paiement. Référence : "+state.providerId()
                        +". Vérifiez son état, sa répartition et les éventuels reversements avant toute nouvelle action.",
                null,state.amount(),state.currency(),null,"EXTERNAL_REFUND"));
        else actions.resolve(state.org(),ActionItemKind.PAYMENT_INCIDENT,state.providerId(),"stripe:reconciled");
    }
}
