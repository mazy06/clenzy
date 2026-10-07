package com.clenzy.service;

import com.clenzy.model.*;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Résout la preuve bancaire unique des affectations, sans inventer d'identifiant Stripe. */
public final class BaitlyRefundEvidence {
    private BaitlyRefundEvidence() {}
    public static Long order(PaymentTransaction refund) {
        return refund.getRefundParent()==null?refund.getId():refund.getRefundParent().getId();
    }
    public static boolean distributed(PaymentTransaction refund) {
        return refund.getRefundParent()==null && BaitlyExternalRefundStore.external(refund)
                && Boolean.TRUE.equals(refund.getMetadata().get("externalBatchDistributed"));
    }
    public static boolean reconciledDistribution(PaymentTransaction refund) {
        return distributed(refund) && refund.getStatus()==TransactionStatus.COMPLETED
                && BaitlyExternalRefundStore.confirmed(refund) && Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired"));
    }
    public static String stripeReference(PaymentTransaction refund) {
        var parent=refund.getRefundParent();
        if(parent==null) return refund.getProviderTxId();
        require(refund.getProviderTxId()==null && refund.getPaymentType()==TransactionType.REFUND
                && refund.getProviderType()==PaymentProviderType.STRIPE && distributed(parent)
                && parent.getStatus()==TransactionStatus.COMPLETED && BaitlyExternalRefundStore.confirmed(parent)
                && !Boolean.TRUE.equals(parent.getMetadata().get("reviewRequired"))
                && Objects.equals(parent.getOrganizationId(),refund.getOrganizationId())
                && Objects.equals(parent.getCurrency(),refund.getCurrency())
                && Objects.equals(parent.getMetadata().get("originalTransactionRef"),refund.getMetadata().get("originalTransactionRef"))
                && parent.getMetadata().get("refundAssignments") instanceof Map<?,?>,
                "Preuve bancaire de l'affectation à rapprocher");
        var assignments=(Map<?,?>)parent.getMetadata().get("refundAssignments");
        require(Objects.equals(assignments.get(refund.getSourceId().toString()),refund.getAmount().toPlainString()),
                "Montant de l'affectation différent de la décision enregistrée");
        return parent.getProviderTxId();
    }
    public static boolean confirmedStripe(PaymentTransaction refund) {
        var reference=stripeReference(refund);
        return reference!=null && reference.startsWith("re_");
    }
}
