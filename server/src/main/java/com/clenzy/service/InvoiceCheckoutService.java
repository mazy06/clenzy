package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import org.springframework.stereotype.Service;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Webhook de facture : relecture Stripe, identité et montants avant tout effet métier. */
@Service
public class InvoiceCheckoutService {
    private final PaymentTransactionRepository payments;
    private final StripeGateway stripe;
    private final InvoicePaymentReconciliationService writer;
    private final TenantContext tenant;
    private final TenantScopedExecutor tenants;

    public InvoiceCheckoutService(PaymentTransactionRepository payments, StripeGateway stripe,
            InvoicePaymentReconciliationService writer, TenantContext tenant, TenantScopedExecutor tenants) {
        this.payments = payments; this.stripe = stripe; this.writer = writer; this.tenant = tenant; this.tenants = tenants;
    }

    public boolean handleWebhook(Session incoming) {
        var tx = payments.findByProviderTxId(incoming.getId());
        boolean announced = incoming.getMetadata() != null && (InvoicePaymentCoordination.SOURCE_TYPE.equals(incoming.getMetadata().get("sourceType"))
                || ReservationPaymentService.SOURCE_TYPE.equals(incoming.getMetadata().get("sourceType")) && incoming.getMetadata().containsKey("invoiceId"));
        if (tx.isEmpty() || !handles(tx.get())) { require(!announced, "Facture pas encore rattachée à la session"); return false; }
        refresh(tx.get()); return true;
    }

    public void refresh(PaymentTransaction tx) {
        require(handles(tx), "Type de paiement non pris en charge");
        final Session session;
        try { session = stripe.retrieveSession(tx.getProviderTxId()); }
        catch (com.stripe.exception.StripeException e) { throw new IllegalStateException("Vérification Stripe de la facture indisponible", e); }
        verify(tx, session);
        Runnable action = () -> {
            if ("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())) writer.confirm(tx.getTransactionRef(), session.getId());
            else if ("expired".equals(session.getStatus()) && "unpaid".equals(session.getPaymentStatus())) writer.expire(tx.getTransactionRef(), session.getId());
        };
        if (tenant.getOrganizationId() == null) tenants.callAsOrganization(tx.getOrganizationId(), () -> { action.run(); return null; });
        else { require(Objects.equals(tenant.getOrganizationId(), tx.getOrganizationId()), "Facture hors organisation"); action.run(); }
    }

    private static boolean handles(PaymentTransaction tx) {
        return InvoicePaymentCoordination.SOURCE_TYPE.equals(tx.getSourceType()) || ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType())
                && InvoicePaymentCoordination.invoiceId(tx.getMetadata()) != null;
    }

    static void verify(PaymentTransaction tx, Session session) {
        require(session != null && Objects.equals(session.getId(), tx.getProviderTxId()) && tx.getProviderType() == PaymentProviderType.STRIPE
                && tx.getPaymentType() == TransactionType.CHECKOUT && "payment".equals(session.getMode())
                && tx.getAmount() != null && Objects.equals(StripeAmounts.toMinorUnits(tx.getAmount()), session.getAmountTotal())
                && tx.getCurrency() != null && tx.getCurrency().equalsIgnoreCase(session.getCurrency()), "Preuve Stripe de facture incohérente");
        var m = session.getMetadata();
        require(m != null && Objects.equals(tx.getTransactionRef(), m.get("transactionRef")) && Objects.equals(tx.getSourceType(), m.get("sourceType"))
                && Objects.equals(String.valueOf(tx.getSourceId()), m.get("sourceId")) && Objects.equals(String.valueOf(tx.getOrganizationId()), m.get("orgId"))
                && tx.getMetadata() != null && InvoicePaymentCoordination.invoiceId(tx.getMetadata()) != null
                && Objects.equals(String.valueOf(tx.getMetadata().get("invoiceId")), m.get("invoiceId")), "Identité de la facture Stripe incohérente");
    }
}
