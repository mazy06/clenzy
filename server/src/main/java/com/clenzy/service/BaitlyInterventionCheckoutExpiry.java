package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.stripe.model.checkout.Session;
import org.springframework.stereotype.Service;
import java.util.Objects;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Une expiration unitaire est relue chez Stripe avant de libérer la dette Baitly. */
@Service
public class BaitlyInterventionCheckoutExpiry {
    private final PaymentTransactionRepository payments;
    private final StripeGateway stripe;
    private final BaitlyInterventionCheckoutExpiryWriter writer;
    private final BaitlyHistoricalCheckoutWriter history;
    private final com.clenzy.tenant.TenantScopedExecutor tenants;
    public BaitlyInterventionCheckoutExpiry(PaymentTransactionRepository payments, StripeGateway stripe,
            BaitlyInterventionCheckoutExpiryWriter writer, com.clenzy.tenant.TenantScopedExecutor tenants,
            BaitlyHistoricalCheckoutWriter history) {
        this.payments = payments; this.stripe = stripe; this.writer = writer; this.tenants = tenants; this.history = history;
    }
    public boolean handleWebhook(String sessionId) {
        var tx = payments.findByProviderTxId(sessionId).filter(t -> "INTERVENTION".equals(t.getSourceType()));
        return tx.isPresent() && tenants.callAsOrganization(tx.get().getOrganizationId(),
                () -> reconcile(sessionId, tx.get().getOrganizationId()));
    }
    public boolean reconcile(String sessionId, Long orgId) {
        var found = payments.findByProviderTxId(sessionId).filter(t -> Objects.equals(orgId, t.getOrganizationId())
                && "INTERVENTION".equals(t.getSourceType()) && t.getPaymentType() == TransactionType.CHECKOUT
                && t.getProviderType() == PaymentProviderType.STRIPE);
        if (found.isEmpty()) return false;
        var tx = found.get();
        if (tx.getStatus() != TransactionStatus.PROCESSING && tx.getStatus() != TransactionStatus.FAILED) return false;
        Session s;
        try { s = stripe.retrieveSession(sessionId); }
        catch (com.stripe.exception.StripeException e) { throw new IllegalStateException("Vérification Stripe indisponible", e); }
        require(s != null && Objects.equals(sessionId, s.getId()) && "payment".equals(s.getMode())
                && tx.getAmount() != null && Objects.equals(StripeAmounts.toMinorUnits(tx.getAmount()), s.getAmountTotal())
                && tx.getCurrency() != null && tx.getCurrency().equalsIgnoreCase(s.getCurrency()),
                "La preuve Stripe ne correspond pas à cet encaissement");
        var m = s.getMetadata();
        require(m != null && Objects.equals(tx.getTransactionRef(), m.get("transactionRef"))
                && "INTERVENTION".equals(m.get("sourceType"))
                && Objects.equals(String.valueOf(orgId), m.get("orgId"))
                && Objects.equals(String.valueOf(tx.getSourceId()), m.get("sourceId"))
                && tx.getMetadata() != null && Objects.equals(tx.getMetadata().get("purpose"), m.get("purpose")),
                "La preuve Stripe ne correspond pas à cette intervention");
        if ("complete".equals(s.getStatus()) && "paid".equals(s.getPaymentStatus())) {
            history.reconcilePaid(tx.getTransactionRef(),sessionId,orgId,tx.getSourceId(),tx.getAmount(),tx.getCurrency(),s.getPaymentIntent());
            return false;
        }
        if (!"expired".equals(s.getStatus()) || !"unpaid".equals(s.getPaymentStatus())) return false;
        // Les anciens flux ayant déjà créé une intention exigent une revue supplémentaire.
        require(s.getPaymentIntent() == null, "Une intention existe encore : rapprochement requis");
        return writer.expire(tx.getTransactionRef(), sessionId, orgId);
    }
}
