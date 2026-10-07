package com.clenzy.service;

import com.clenzy.model.*;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Rapproche un préfixe local à la photographie complète des restitutions du PSP. */
final class BaitlyExternalRefundSeries {
    private BaitlyExternalRefundSeries() {}

    static BigDecimal before(PaymentTransaction original,PaymentTransaction current,List<PaymentTransaction> rows,
            List<BaitlyExternalRefundProof> snapshot) {
        var proofs=new HashMap<String,BaitlyExternalRefundProof>();
        for(var proof:snapshot) {
            proof.requireOriginal(original);
            require("succeeded".equals(proof.stripeStatus()) && proofs.putIfAbsent(proof.refundId(),proof)==null,
                    "Photographie des remboursements incohérente");
        }
        var refunds=rows.stream().filter(p -> p.getPaymentType()==TransactionType.REFUND)
                .filter(p -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)).toList();
        require(refunds.size()==proofs.size(),"Un remboursement Stripe reste à rapprocher");
        var used=new HashSet<String>();
        for(var row:refunds) {
            var proof=proofs.get(row.getProviderTxId());
            require(proof!=null && used.add(row.getProviderTxId()) && Objects.equals(row.getOrganizationId(),original.getOrganizationId())
                    && Objects.equals(row.getSourceType(),original.getSourceType()) && Objects.equals(row.getSourceId(),original.getSourceId())
                    && row.getProviderType()==original.getProviderType() && Objects.equals(row.getCurrency(),original.getCurrency())
                    && row.getMetadata()!=null && Objects.equals(row.getMetadata().get("originalTransactionRef"),original.getTransactionRef())
                    && row.getAmount()!=null && row.getAmount().signum()>0 && row.getAmount().compareTo(proof.amount())==0,
                    "Remboursement lié à un autre encaissement");
            if(row.getId()<current.getId()) require(row.getStatus()==TransactionStatus.COMPLETED,
                    "Le remboursement précédent doit être rapproché");
            else require((current.getStatus()==TransactionStatus.COMPLETED && row.getStatus()==TransactionStatus.COMPLETED
                        && (BaitlyExternalRefundStore.confirmed(row) || PaymentPersistence.managedRefund(row)))
                    || (BaitlyExternalRefundStore.external(row) && row.getStatus()==TransactionStatus.PROCESSING
                        && !BaitlyExternalRefundStore.confirmed(row) && "succeeded".equals(row.getMetadata().get("stripeStatus"))),
                    "Une autre décision de remboursement doit être rapprochée");
        }
        require(refunds.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add)
                .compareTo(original.getAmount())<=0,"Le cumul dépasse l'encaissement");
        var previous=BaitlyRefundSeries.history(original,refunds.stream().filter(p -> p.getId()<current.getId()).toList());
        return previous.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
    }
}
