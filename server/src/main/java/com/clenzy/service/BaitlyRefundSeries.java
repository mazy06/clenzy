package com.clenzy.service;

import com.clenzy.model.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Budget cumulatif Baitly ; les décisions ambiguës ne libèrent jamais de montant. */
public final class BaitlyRefundSeries {
    private BaitlyRefundSeries() {}

    public static boolean isSeries(PaymentTransaction refund) {
        return (PaymentPersistence.managedRefund(refund) || BaitlyExternalRefundStore.confirmed(refund))
                && Boolean.TRUE.equals(refund.getMetadata().get("cumulativeRefund"));
    }
    public static BigDecimal before(PaymentTransaction refund) {
        return isSeries(refund) ? new BigDecimal(Objects.toString(refund.getMetadata().get("refundBefore"))) : BigDecimal.ZERO;
    }
    public static BigDecimal after(PaymentTransaction refund) { return before(refund).add(refund.getAmount()); }

    public static List<PaymentTransaction> history(PaymentTransaction original, List<PaymentTransaction> rows) {
        return history(original, rows, original.getSourceType(), original.getSourceId(), original.getAmount());
    }

    /** Le budget et la source appartiennent à la part, la preuve PSP au lot. */
    static List<PaymentTransaction> history(PaymentTransaction original, List<PaymentTransaction> rows,
            String sourceType, Long sourceId, BigDecimal budget) {
        var result = rows.stream().filter(p -> p.getPaymentType()==TransactionType.REFUND)
                .filter(p -> !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)).toList();
        for(var p:result) require(Objects.equals(p.getOrganizationId(),original.getOrganizationId())
                && Objects.equals(p.getSourceType(),sourceType) && Objects.equals(p.getSourceId(),sourceId)
                && p.getProviderType()==original.getProviderType() && Objects.equals(p.getCurrency(),original.getCurrency())
                && p.getMetadata()!=null && Objects.equals(p.getMetadata().get("originalTransactionRef"),original.getTransactionRef())
                && !Boolean.TRUE.equals(p.getMetadata().get("reviewRequired"))
                && p.getAmount()!=null && p.getAmount().signum()>0
                && (PaymentPersistence.managedRefund(p) || BaitlyExternalRefundStore.confirmed(p)),
                "Un remboursement historique doit être rapproché avant une nouvelle restitution");
        require(result.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add)
                .compareTo(budget)<=0,"Le cumul dépasse l'encaissement");
        var ordered=result.stream().sorted(Comparator.comparing(BaitlyRefundEvidence::order)).toList();
        var references=new HashSet<String>(); var proofs=new HashSet<String>(); BigDecimal cumulative=BigDecimal.ZERO;
        for(var p:ordered) {
            require(p.getTransactionRef()!=null && references.add(p.getTransactionRef())
                    && (p.getProviderTxId()==null || proofs.add(p.getProviderTxId())),"Preuve de restitution utilisée plusieurs fois");
            if(isSeries(p)) require(before(p).compareTo(cumulative)==0,"Cumul historique incohérent");
            cumulative=cumulative.add(p.getAmount());
        }
        return ordered;
    }

    /** Différence de deux proratas cumulés : la dernière restitution absorbe exactement les centimes. */
    public static BigDecimal delta(BigDecimal value, BigDecimal before, BigDecimal after, BigDecimal total) {
        require(total!=null && total.signum()>0 && before.signum()>=0 && after.compareTo(before)>=0
                && after.compareTo(total)<=0,"Budget de remboursement incohérent");
        return value.multiply(after).divide(total,2,RoundingMode.HALF_UP)
                .subtract(value.multiply(before).divide(total,2,RoundingMode.HALF_UP));
    }

    /** Répartition monotone en centimes, avec priorité au plus grand quotient et ordre stable pour les ex æquo. */
    public static List<BigDecimal> apportion(List<BigDecimal> weights, BigDecimal target) {
        var units=weights.stream().map(v -> v.movePointRight(2).longValueExact()).toList();
        long total=0; for(long value:units) { require(value>=0,"Base de répartition négative"); total=Math.addExact(total,value); }
        long count=target.movePointRight(2).longValueExact(); require(count>=0 && count<=total,"Répartition hors budget");
        long[] shares=new long[units.size()]; long used=0;
        if(total==0) return weights.stream().map(v -> BigDecimal.ZERO.setScale(2)).toList();
        var divisor=java.math.BigInteger.valueOf(total);
        for(int i=0;i<units.size();i++) {
            shares[i]=java.math.BigInteger.valueOf(count).multiply(java.math.BigInteger.valueOf(units.get(i))).divide(divisor).longValueExact();
            used=Math.addExact(used,shares[i]);
        }
        while(used<count) {
            int best=-1;
            for(int i=0;i<units.size();i++) if(shares[i]<units.get(i) && (best<0
                    || java.math.BigInteger.valueOf(units.get(i)).multiply(java.math.BigInteger.valueOf(shares[best]+1))
                    .compareTo(java.math.BigInteger.valueOf(units.get(best)).multiply(java.math.BigInteger.valueOf(shares[i]+1)))>0)) best=i;
            require(best>=0,"Répartition impossible"); shares[best]++; used++;
        }
        var result=new ArrayList<BigDecimal>(); for(long value:shares) result.add(BigDecimal.valueOf(value,2)); return result;
    }
    public static void require(boolean valid,String message) {
        if(!valid) throw new com.clenzy.exception.PaymentValidationException(message);
    }
}
