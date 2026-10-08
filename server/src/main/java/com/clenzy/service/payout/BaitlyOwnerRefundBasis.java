package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.service.BaitlyRefundSeries;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Preuve figée du solde d'un séjour dans un transfert propriétaire éventuellement multi-séjours. */
public final class BaitlyOwnerRefundBasis {
    public record Basis(BigDecimal gross,BigDecimal net,BigDecimal before) {}
    public static Basis requireBasis(EntityManager em,PaymentTransaction refund,PayoutTransfer transfer) {
        require("RESERVATION".equals(refund.getSourceType()) && transfer.getSource()==PayoutTransfer.Source.OWNER_PAYOUT,
                "Source de récupération propriétaire différente");
        var payout=em.find(OwnerPayout.class,transfer.getSourceId());
        require(payout!=null,"Reversement propriétaire absent"); em.refresh(payout,LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(payout.getOrganizationId(),refund.getOrganizationId()) && payout.getFundingVersion()==1
                && payout.getStatus()==OwnerPayout.PayoutStatus.PAID && Objects.equals(payout.getOwnerId(),transfer.getBeneficiaryUserId())
                && Objects.equals(payout.getStripeTransferId(),transfer.getExternalReference())
                && payout.getNetAmount().compareTo(transfer.getAmount())==0 && payout.getCurrency().equals(refund.getCurrency()),
                "Reversement propriétaire non rapproché");
        var claims=em.createQuery("from OwnerPayoutReservation where payoutId=:payout and organizationId=:org",OwnerPayoutReservation.class)
                .setParameter("payout",payout.getId()).setParameter("org",payout.getOrganizationId()).getResultList();
        var claim=claims.stream().filter(c->Objects.equals(c.getReservationId(),refund.getSourceId())).findFirst().orElseThrow();
        require(claim.getCurrency().equals(refund.getCurrency()) && claims.stream().map(OwnerPayoutReservation::getCollectedAmount)
                .reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(payout.getGrossRevenue())==0,"Séjours du reversement incohérents");
        BigDecimal net=claim.getNetAmount();
        if(net==null) {
            // Un seul séjour possède une part certaine. Aucune ventilation rétroactive inventée.
            require(claims.size()==1,"Les parts nettes de cet ancien reversement doivent être rapprochées"); net=payout.getNetAmount();
        } else require(claims.stream().allMatch(c->c.getNetAmount()!=null) && claims.stream().map(OwnerPayoutReservation::getNetAmount)
                .reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(payout.getNetAmount())==0,"Parts nettes différentes du transfert");
        var originals=em.createQuery("from PaymentTransaction where organizationId=:org and transactionRef=:ref",PaymentTransaction.class)
                .setParameter("org",refund.getOrganizationId()).setParameter("ref",refund.getMetadata().get("originalTransactionRef")).getResultList();
        require(originals.size()==1,"Encaissement du séjour absent"); var original=originals.getFirst();
        require(claim.getPaymentTransactionIds().contains(original.getId()) && "RESERVATION".equals(original.getSourceType())
                && Objects.equals(original.getSourceId(),refund.getSourceId()) && original.getStatus()==TransactionStatus.COMPLETED
                && original.getPaymentType()==TransactionType.CHECKOUT && !original.hasDisputeRisk(),"Encaissement différent du reversement");
        var before=BaitlyRefundSeries.before(refund).subtract(original.getAmount().subtract(claim.getCollectedAmount()));
        require(before.signum()>=0 && before.add(refund.getAmount()).compareTo(claim.getCollectedAmount())<=0
                && net.signum()>=0 && net.compareTo(claim.getCollectedAmount())<=0,"Remboursement hors part reversée");
        return new Basis(claim.getCollectedAmount(),net,before);
    }
}
