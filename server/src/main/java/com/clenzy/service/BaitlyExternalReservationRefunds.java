package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.payout.ReservationPayoutFunding;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Affectation certaine à un seul séjour. Ne demande jamais de remboursement au PSP. */
@Service @Transactional(propagation=Propagation.MANDATORY)
public class BaitlyExternalReservationRefunds {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final OwnerPayoutReservationRepository claims;
    private final ReservationCancellationLedger ledger;
    private final com.clenzy.service.payout.BaitlyTransferRecoveryStore recoveries;
    private final com.clenzy.booking.service.GuestCreditService credits;
    public BaitlyExternalReservationRefunds(EntityManager em,PaymentTransactionRepository payments,
            OwnerPayoutReservationRepository claims,ReservationCancellationLedger ledger,
            com.clenzy.service.payout.BaitlyTransferRecoveryStore recoveries,com.clenzy.booking.service.GuestCreditService credits) {
        this.em=em;this.payments=payments;this.claims=claims;this.ledger=ledger;
        this.recoveries=recoveries;this.credits=credits;
    }
    public void reconcile(PaymentTransaction original,PaymentTransaction refund,List<BaitlyExternalRefundProof> snapshot) {
        var stay=em.find(Reservation.class,original.getSourceId());
        require(stay!=null && Objects.equals(stay.getOrganizationId(),original.getOrganizationId()),"Séjour hors organisation");
        em.refresh(stay,LockModeType.PESSIMISTIC_WRITE);
        require(original.getStatus()==TransactionStatus.COMPLETED && !original.hasDisputeRisk()
                && original.getPaymentType()==TransactionType.CHECKOUT && original.getProviderType()==PaymentProviderType.STRIPE
                && "RESERVATION".equals(original.getSourceType()) && "RESERVATION".equals(refund.getSourceType())
                && Objects.equals(refund.getOrganizationId(),original.getOrganizationId()) && Objects.equals(refund.getSourceId(),stay.getId())
                && "EUR".equals(original.getCurrency()) && "EUR".equals(stay.getCurrency())
                && "EUR".equals(refund.getCurrency()) && stay.getPaymentCollection()==PaymentCollection.PMS
                && Objects.equals(stay.getStripeSessionId(),original.getProviderTxId())
                && stay.getTotalPrice()!=null && com.clenzy.booking.service.BaitlyReservationCredit.cash(stay).compareTo(original.getAmount())==0
                && BaitlyExternalRefundStore.external(refund),"Encaissement du séjour à rapprocher");
        var rows=payments.findReservationFunding(stay.getOrganizationId(),List.of(stay.getId()),ReservationPayoutFunding.FUNDING_SOURCES);
        rows.forEach(em::refresh);
        require(rows.stream().allMatch(row -> Objects.equals(row.getId(),original.getId())
                || (row.getPaymentType()==TransactionType.REFUND && "RESERVATION".equals(row.getSourceType()))
                || (row.getPaymentType()==TransactionType.CHECKOUT && row.getStatus()==TransactionStatus.CANCELLED)),
                "Un autre financement ou dossier d'annulation doit être rapproché");
        BigDecimal before=BaitlyExternalRefundSeries.before(original,refund,rows,snapshot);
        require(stay.getPaymentStatus()==(before.signum()==0?PaymentStatus.PAID:PaymentStatus.PARTIALLY_REFUNDED),
                "Statut et cumul remboursé du séjour incohérents");
        var metadata=new HashMap<>(refund.getMetadata());metadata.put("cumulativeRefund",true);
        metadata.put("refundBefore",before.toPlainString());metadata.put("refundAfter",before.add(refund.getAmount()).toPlainString());
        metadata.put("originalAmount",original.getAmount().toPlainString());metadata.put("checkoutSessionId",original.getProviderTxId());
        metadata.put("externalRefundConfirmed",true);metadata.put("reviewRequired",false);refund.setMetadata(metadata);
        if(!claims.findClaimedReservationIds(List.of(stay.getId())).isEmpty()) {
            recoveries.prepareOwnerRefund(refund);
            metadata=new HashMap<>(refund.getMetadata());metadata.put("ownerRecoveryRequired",true);refund.setMetadata(metadata);
        }
        credits.reverseRewards(stay.getOrganizationId(),stay.getConfirmationCode(),original.getAmount(),before,before.add(refund.getAmount()),refund.getTransactionRef());
        if(com.clenzy.booking.service.BaitlyReservationCredit.applied(stay).signum()>0) {
            var expectedAccount=com.clenzy.booking.service.BaitlyReservationCredit.requireIntent(stay,original);
            credits.restoreConsumed(stay.getOrganizationId(),stay.getConfirmationCode(),stay.getCreditApplied().movePointRight(2).longValueExact(),
                    original.getAmount(),before,before.add(refund.getAmount()),refund.getTransactionRef(),expectedAccount);
        }
        ledger.reverse(stay,refund,original.getAmount());
        stay.setPaymentStatus(before.add(refund.getAmount()).compareTo(original.getAmount())==0?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED);
    }
}
