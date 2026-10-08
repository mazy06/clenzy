package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.stripe.model.Charge;
import com.stripe.model.Dispute;
import com.stripe.model.checkout.Session;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Chaîne vérifiée chez le PSP, sans faire confiance au montant ni à l'organisation du webhook. */
public record BaitlyDisputeProof(Long paymentId, Long org, String session, String dispute, String charge,
        String intent, BigDecimal amount, String currency, String status, Instant deadline, List<Movement> movements) {
    public record Movement(String reference, BigDecimal amount, BigDecimal fee, BigDecimal net, String currency,
            Instant created, Instant available) {}
    public static BaitlyDisputeProof checked(PaymentTransaction payment, Session session, Charge charge, Dispute dispute) {
        require(payment.getId()!=null && payment.getOrganizationId()!=null && payment.getProviderType()==PaymentProviderType.STRIPE
                && payment.getPaymentType()==TransactionType.CHECKOUT && payment.getStatus()==TransactionStatus.COMPLETED
                && payment.getProviderTxId()!=null && Objects.equals(payment.getProviderTxId(),session.getId())
                && "payment".equals(session.getMode()) && "complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
                && session.getMetadata()!=null && payment.getTransactionRef().equals(session.getMetadata().get("transactionRef"))
                && session.getPaymentIntent()!=null && session.getPaymentIntent().equals(charge.getPaymentIntent())
                && session.getPaymentIntent().equals(dispute.getPaymentIntent()) && Objects.equals(charge.getId(),dispute.getCharge())
                && Boolean.TRUE.equals(charge.getPaid()) && dispute.getLivemode()!=null
                && dispute.getLivemode().equals(charge.getLivemode()) && dispute.getLivemode().equals(session.getLivemode()),
                "Chaîne du litige Stripe incohérente");
        require("EUR".equals(payment.getCurrency()) && "eur".equals(session.getCurrency()) && "eur".equals(charge.getCurrency())
                && "eur".equals(dispute.getCurrency()) && payment.getAmount()!=null && payment.getAmount().signum()>0
                && Objects.equals(session.getAmountTotal(),StripeAmounts.toMinorUnits(payment.getAmount()))
                && Objects.equals(charge.getAmount(),session.getAmountTotal()) && dispute.getAmount()!=null
                && dispute.getAmount()>0 && dispute.getAmount()<=charge.getAmount(), "Montant du litige à rapprocher");
        require(Set.of("needs_response","under_review","warning_needs_response","warning_under_review","warning_closed","won","lost","prevented")
                .contains(Objects.toString(dispute.getStatus(),"")), "État Stripe du litige inconnu");
        var movements=new ArrayList<Movement>(); var seen=new HashSet<String>();
        for(var movement : dispute.getBalanceTransactions()==null ? List.<com.stripe.model.BalanceTransaction>of() : dispute.getBalanceTransactions()) {
            require(movement.getId()!=null && movement.getId().startsWith("txn_") && seen.add(movement.getId())
                    && Objects.equals(movement.getCurrency(),dispute.getCurrency()) && movement.getAmount()!=null
                    && movement.getFee()!=null && movement.getNet()!=null && movement.getCreated()!=null
                    && movement.getAvailableOn()!=null && movement.getAmount()-movement.getFee()==movement.getNet(),
                    "Mouvement de solde Stripe incohérent");
            movements.add(new Movement(movement.getId(),BigDecimal.valueOf(movement.getAmount(),2),
                    BigDecimal.valueOf(movement.getFee(),2),BigDecimal.valueOf(movement.getNet(),2),"EUR",
                    Instant.ofEpochSecond(movement.getCreated()),Instant.ofEpochSecond(movement.getAvailableOn())));
        }
        Long due=dispute.getEvidenceDetails()==null?null:dispute.getEvidenceDetails().getDueBy();
        return new BaitlyDisputeProof(payment.getId(),payment.getOrganizationId(),session.getId(),dispute.getId(),charge.getId(),
                session.getPaymentIntent(),BigDecimal.valueOf(dispute.getAmount(),2),"EUR",dispute.getStatus(),
                due==null?null:Instant.ofEpochSecond(due),List.copyOf(movements));
    }
    public boolean released() { return Set.of("won","warning_closed").contains(status); }
    private static void require(boolean ok,String message) { if(!ok) throw new IllegalStateException(message); }
}
