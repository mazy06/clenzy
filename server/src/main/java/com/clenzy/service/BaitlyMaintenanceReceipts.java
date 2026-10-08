package com.clenzy.service;

import com.clenzy.model.*;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Preuves distinctes d'acompte et de solde ; une référence historique seule ne vaut pas encaissement. */
public record BaitlyMaintenanceReceipts(BigDecimal gross, List<PaymentTransaction> receipts) {
    public BaitlyMaintenanceReceipts { receipts = List.copyOf(receipts); }

    public static boolean multiple(List<PaymentTransaction> rows) {
        return rows.stream().filter(p -> p.getPaymentType()==TransactionType.CHECKOUT)
                .filter(BaitlyCheckoutEvidence::requiresReconciliation).count()>1;
    }

    public static BaitlyMaintenanceReceipts verify(Intervention mission, List<PaymentTransaction> rows,
                                                   List<ServiceQuote> quotes) {
        var receipts=rows.stream().filter(p -> p.getPaymentType()==TransactionType.CHECKOUT)
                .filter(BaitlyCheckoutEvidence::requiresReconciliation).toList();
        require(receipts.size()==2,"Deux preuves distinctes d'acompte et de solde sont nécessaires");
        var deposits=receipts.stream().filter(DepositReconciler::isDeposit).toList();
        var balances=receipts.stream().filter(p -> !DepositReconciler.isDeposit(p)).toList();
        var accepted=quotes.stream().filter(q -> q.getStatus()==ServiceQuote.Status.APPROVED).toList();
        require(deposits.size()==1 && balances.size()==1 && accepted.size()==1,"Acompte, solde et devis à rapprocher");
        var deposit=deposits.getFirst(); var balance=balances.getFirst(); var quote=accepted.getFirst();
        DepositReconciler.validate(deposit,quote);
        require(quote.getDepositPaidAt()!=null && Objects.equals(quote.getDepositTransactionRef(),deposit.getTransactionRef()),
                "L'acompte du devis n'est pas confirmé");
        var sessions=new HashSet<String>();var references=new HashSet<String>();
        for(var receipt:receipts) {
            require(Objects.equals(mission.getOrganizationId(),receipt.getOrganizationId())
                    && Objects.equals(mission.getId(),receipt.getSourceId()) && "INTERVENTION".equals(receipt.getSourceType())
                    && receipt.getStatus()==TransactionStatus.COMPLETED && receipt.getProviderType()==PaymentProviderType.STRIPE
                    && !receipt.hasDisputeRisk() && receipt.getAmount()!=null && receipt.getAmount().signum()>0
                    && "EUR".equals(receipt.getCurrency()) && Objects.equals(mission.getCurrency(),receipt.getCurrency())
                    && receipt.getId()!=null && receipt.getTransactionRef()!=null && references.add(receipt.getTransactionRef())
                    && receipt.getProviderTxId()!=null && receipt.getProviderTxId().startsWith("cs_") && sessions.add(receipt.getProviderTxId())
                    && (receipt.getMetadata()==null || !receipt.getMetadata().containsKey("interventionIds")
                        || mission.getId().toString().equals(Objects.toString(receipt.getMetadata().get("interventionIds")).trim())),
                    "Un encaissement de maintenance est partagé, contesté ou incomplet");
        }
        var gross=deposit.getAmount().add(balance.getAmount());
        require(mission.getEstimatedCost()!=null && gross.compareTo(mission.getEstimatedCost())==0
                && quote.getAmount()!=null && gross.compareTo(quote.getAmount())==0
                && Objects.equals(mission.getStripeSessionId(),balance.getProviderTxId()),"Le cumul ne correspond pas au devis et au solde confirmé");
        return new BaitlyMaintenanceReceipts(gross,List.of(balance,deposit));
    }

    public static List<PaymentTransaction> forReceipt(PaymentTransaction original,List<PaymentTransaction> rows) {
        return rows.stream().filter(p -> p.getPaymentType()!=TransactionType.REFUND || p.getMetadata()!=null
                && Objects.equals(original.getTransactionRef(),p.getMetadata().get("originalTransactionRef"))).toList();
    }

    public List<PaymentTransaction> history(List<PaymentTransaction> rows) {
        var known=receipts.stream().map(PaymentTransaction::getTransactionRef).toList();
        var refunds=rows.stream().filter(p -> p.getPaymentType()==TransactionType.REFUND)
                .filter(p -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)).toList();
        require(refunds.stream().allMatch(p -> p.getMetadata()!=null && known.contains(p.getMetadata().get("originalTransactionRef"))),
                "Un remboursement sans encaissement identifié doit être rapproché");
        for(var receipt:receipts) BaitlyRefundSeries.history(receipt,forReceipt(receipt,rows));
        return refunds.stream().sorted(Comparator.comparing(BaitlyRefundEvidence::order)).toList();
    }

    public static boolean aggregated(PaymentTransaction refund) {
        return refund.getMetadata()!=null && Boolean.TRUE.equals(refund.getMetadata().get("maintenanceRefund"));
    }
    public static BigDecimal before(PaymentTransaction refund) {
        return aggregated(refund) ? new BigDecimal(Objects.toString(refund.getMetadata().get("maintenanceRefundBefore")))
                : BaitlyRefundSeries.before(refund);
    }
    /** Vue comptable du même remboursement, sans modifier sa preuve ni son cumul PSP. */
    public static PaymentTransaction accounting(PaymentTransaction refund) {
        if(!aggregated(refund)) return refund;
        var copy=new PaymentTransaction();copy.setId(refund.getId());copy.setOrganizationId(refund.getOrganizationId());
        copy.setSourceId(refund.getSourceId());copy.setSourceType(refund.getSourceType());copy.setAmount(refund.getAmount());
        copy.setCurrency(refund.getCurrency());copy.setPaymentType(refund.getPaymentType());copy.setStatus(refund.getStatus());
        copy.setProviderType(refund.getProviderType());copy.setProviderTxId(refund.getProviderTxId());copy.setTransactionRef(refund.getTransactionRef());
        copy.setIdempotencyKey(refund.getIdempotencyKey());
        var metadata=new HashMap<>(refund.getMetadata());metadata.put("refundBefore",before(refund).toPlainString());
        metadata.put("refundAfter",before(refund).add(refund.getAmount()).toPlainString());copy.setMetadata(metadata);
        return copy;
    }
}
