package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.function.Supplier;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Lecture Stripe canonique hors transaction ; webhook et retour Baitly partagent ce chemin. */
@Service
public class InterventionBatchCheckoutService {
    private final PaymentTransactionRepository payments;
    private final StripeGateway stripe;
    private final InterventionBatchReconciliationService writer;
    private final TenantContext tenant;
    private final TenantScopedExecutor tenants;

    public InterventionBatchCheckoutService(PaymentTransactionRepository payments, StripeGateway stripe,
            InterventionBatchReconciliationService writer, TenantContext tenant, TenantScopedExecutor tenants) {
        this.payments = payments; this.stripe = stripe; this.writer = writer;
        this.tenant = tenant; this.tenants = tenants;
    }

    public boolean handleWebhook(Session eventSession) {
        var tx = payments.findByProviderTxId(eventSession.getId());
        boolean announced = eventSession.getMetadata() != null
                && InterventionPaymentBatch.SOURCE_TYPE.equals(eventSession.getMetadata().get("sourceType"));
        if (tx.isEmpty() || !InterventionPaymentBatch.SOURCE_TYPE.equals(tx.get().getSourceType())) {
            // Un webhook peut précéder le commit de l'association de session : Stripe doit réessayer.
            require(!announced, "Session du lot pas encore rattachée");
            return false;
        }
        refresh(tx.get());
        return true;
    }

    public Optional<Map<String, Object>> sessionStatus(String sessionId, Long orgId) {
        var tx = payments.findByProviderTxId(sessionId)
                .filter(t -> InterventionPaymentBatch.SOURCE_TYPE.equals(t.getSourceType())
                        && Objects.equals(orgId, t.getOrganizationId()));
        if (tx.isEmpty()) return Optional.empty();
        String status = refresh(tx.get());
        return Optional.of(Map.of("paymentStatus", status, "interventionStatus", "GROUPED"));
    }

    private String refresh(PaymentTransaction tx) {
        Session session;
        try { session = stripe.retrieveSession(tx.getProviderTxId()); }
        catch (com.stripe.exception.StripeException ex) { throw new IllegalStateException("Vérification Stripe du lot indisponible", ex); }
        verify(tx, session);
        return inOrganization(tx.getOrganizationId(), () -> {
            if ("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())) {
                writer.confirm(tx.getTransactionRef(), session.getId());
                return "PAID";
            }
            if ("expired".equals(session.getStatus()) && "unpaid".equals(session.getPaymentStatus())) {
                writer.expire(tx.getTransactionRef(), session.getId());
                return tx.getStatus() == TransactionStatus.COMPLETED ? "PAID" : "FAILED";
            }
            // Une session terminée mais non payée peut encore attendre un moyen asynchrone.
            // Aucun nouvel essai sans preuve définitive d'absence d'encaissement.
            return tx.getStatus() == TransactionStatus.COMPLETED ? "PAID" : "PROCESSING";
        });
    }

    static void verify(PaymentTransaction tx, Session session) {
        require(session != null && Objects.equals(tx.getProviderTxId(), session.getId())
                && tx.getProviderType() == PaymentProviderType.STRIPE && tx.getPaymentType() == TransactionType.CHECKOUT
                && "payment".equals(session.getMode()) && tx.getAmount() != null
                && Objects.equals(StripeAmounts.toMinorUnits(tx.getAmount()), session.getAmountTotal())
                && tx.getCurrency() != null && tx.getCurrency().equalsIgnoreCase(session.getCurrency()),
                "La preuve Stripe ne correspond pas au montant du lot");
        var metadata = session.getMetadata();
        require(metadata != null && Objects.equals(tx.getTransactionRef(), metadata.get("transactionRef"))
                && InterventionPaymentBatch.SOURCE_TYPE.equals(metadata.get("sourceType"))
                && Objects.equals(String.valueOf(tx.getOrganizationId()), metadata.get("orgId"))
                && tx.getMetadata() != null && Objects.equals(tx.getMetadata().get("interventionIds"), metadata.get("interventionIds")),
                "La preuve Stripe ne correspond pas aux interventions du lot");
    }

    private <T> T inOrganization(Long org, Supplier<T> action) {
        if (tenant.getOrganizationId() == null) return tenants.callAsOrganization(org, action);
        require(Objects.equals(org, tenant.getOrganizationId()), "Lot hors organisation");
        return action.get();
    }
}
