package com.clenzy.model;

import java.util.Objects;

/** Une tentative échouée reste ambiguë sauf preuve persistée d'expiration sans encaissement. */
public final class BaitlyCheckoutEvidence {
    private BaitlyCheckoutEvidence() {}

    public static boolean requiresReconciliation(PaymentTransaction payment) {
        if (payment.getStatus() == TransactionStatus.CANCELLED) return false;
        var metadata = payment.getMetadata();
        boolean expired = payment.getStatus() == TransactionStatus.FAILED
                && payment.getPaymentType() == TransactionType.CHECKOUT
                && payment.getProviderType() == PaymentProviderType.STRIPE
                && "INTERVENTION".equals(payment.getSourceType())
                && payment.getProviderTxId() != null && payment.getProviderTxId().startsWith("cs_")
                && metadata != null && Boolean.TRUE.equals(metadata.get("standaloneRetryAllowed"))
                && Objects.equals(payment.getProviderTxId(), metadata.get("expiredSessionId"));
        return !expired;
    }
}
