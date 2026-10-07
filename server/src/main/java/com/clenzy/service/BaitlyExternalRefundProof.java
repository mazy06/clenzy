package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import java.math.BigDecimal;
import java.util.Objects;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Instantané immuable : identités relues chez Stripe et organisation issue du paiement local. */
public record BaitlyExternalRefundProof(Long org, String originalRef, String sessionId, String source,
        Long sourceId, BigDecimal originalAmount, String currency, String refundId, String intent,
        BigDecimal amount, String stripeStatus) {
    public static BaitlyExternalRefundProof checked(PaymentTransaction payment, Session session, Refund refund) {
        require(payment.getPaymentType()==TransactionType.CHECKOUT && payment.getProviderType()==PaymentProviderType.STRIPE
                && payment.getOrganizationId()!=null && payment.getSourceId()!=null && payment.getSourceType()!=null
                && payment.getAmount()!=null && payment.getAmount().signum()>0 && "EUR".equals(payment.getCurrency()),
                "Encaissement Stripe EUR requis");
        var metadata=session.getMetadata();
        require(Objects.equals(payment.getProviderTxId(),session.getId()) && "payment".equals(session.getMode())
                && "complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
                && Objects.equals(session.getAmountTotal(),StripeAmounts.toMinorUnits(payment.getAmount()))
                && "eur".equalsIgnoreCase(session.getCurrency()) && metadata!=null
                && payment.getTransactionRef().equals(metadata.get("transactionRef"))
                && payment.getOrganizationId().toString().equals(metadata.get("orgId"))
                && payment.getSourceType().equals(metadata.get("sourceType"))
                && payment.getSourceId().toString().equals(metadata.get("sourceId")), "Identité Checkout incohérente");
        require(refund.getId()!=null && refund.getId().startsWith("re_") && refund.getPaymentIntent()!=null
                && refund.getPaymentIntent().equals(session.getPaymentIntent()) && refund.getAmount()!=null
                && refund.getAmount()>0 && refund.getAmount()<=session.getAmountTotal()
                && "eur".equalsIgnoreCase(refund.getCurrency()) && refund.getStatus()!=null,
                "Remboursement Stripe incohérent");
        return new BaitlyExternalRefundProof(payment.getOrganizationId(),payment.getTransactionRef(),session.getId(),
                payment.getSourceType(),payment.getSourceId(),payment.getAmount(),payment.getCurrency(),refund.getId(),
                refund.getPaymentIntent(),BigDecimal.valueOf(refund.getAmount(),2),refund.getStatus());
    }
    public boolean rejected() { return "failed".equals(stripeStatus)||"canceled".equals(stripeStatus); }
    public void requireOriginal(PaymentTransaction payment) {
        require(Objects.equals(payment.getOrganizationId(),org) && payment.getPaymentType()==TransactionType.CHECKOUT
                && payment.getProviderType()==PaymentProviderType.STRIPE && Objects.equals(payment.getTransactionRef(),originalRef)
                && Objects.equals(payment.getProviderTxId(),sessionId) && Objects.equals(payment.getSourceType(),source)
                && Objects.equals(payment.getSourceId(),sourceId) && Objects.equals(payment.getCurrency(),currency)
                && payment.getAmount().compareTo(originalAmount)==0, "Encaissement modifié pendant la vérification");
    }
}
