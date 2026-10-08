package com.clenzy.service;

import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.Objects;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Rattrape aussi les factures créées après le webhook, sans rejouer les effets financiers. */
@Service
public class BaitlyInvoicePaymentRecovery {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BaitlyInvoicePaymentRecovery.class);
    private final BaitlyInvoicePaymentMatching matching;
    private final StripeGateway stripe;
    private final TenantScopedExecutor tenants;
    private long cursor;
    public BaitlyInvoicePaymentRecovery(BaitlyInvoicePaymentMatching matching, StripeGateway stripe, TenantScopedExecutor tenants) {
        this.matching = matching; this.stripe = stripe; this.tenants = tenants;
    }
    @Scheduled(initialDelayString="${baitly.payments.invoice-match-ms:60000}", fixedDelayString="${baitly.payments.invoice-match-ms:60000}")
    @SchedulerLock(name="baitly-invoice-payment-matching", lockAtMostFor="PT10M")
    public void resume() {
        var candidates = matching.candidates(cursor);
        if (candidates.isEmpty()) { cursor = 0; return; }
        for (var candidate : candidates) {
            tenants.runAsOrganization(candidate.organizationId(), () -> {
                try { reconcile(candidate.invoiceId()); }
                catch (Exception failure) {
                    matching.recordFailure(candidate.invoiceId());
                    log.warn("Facture {} : rapprochement différé ({})", candidate.invoiceId(), failure.getClass().getSimpleName());
                }
            });
            cursor = candidate.invoiceId();
        }
    }
    public void reconcile(Long invoiceId) throws com.stripe.exception.StripeException {
        var proof = matching.prepare(invoiceId);
        // GET Stripe hors des transactions courtes de prepare/apply ; aucun POST de paiement.
        verify(proof, stripe.retrieveSession(proof.sessionId()));
        matching.apply(proof);
    }
    static void verify(BaitlyInvoicePaymentMatching.Evidence p, Session session) {
        require(session != null && Objects.equals(session.getId(), p.sessionId()) && "payment".equals(session.getMode())
                && "complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
                && Objects.equals(session.getAmountTotal(), StripeAmounts.toMinorUnits(p.collected()))
                && p.currency().equalsIgnoreCase(session.getCurrency()) && session.getPaymentIntent() != null,
                "Paiement Stripe non confirmé ou montant incohérent");
        var m = session.getMetadata();
        require(m != null && Objects.equals(p.ref(), m.get("transactionRef")) && Objects.equals(p.source(), m.get("sourceType"))
                && Objects.equals(p.sourceId().toString(), m.get("sourceId")) && Objects.equals(p.organizationId().toString(), m.get("orgId"))
                && (!"INTERVENTION_BATCH".equals(p.source()) || Objects.equals(p.interventionIds(), m.get("interventionIds"))),
                "Identité de l'encaissement Stripe incohérente");
    }
}
