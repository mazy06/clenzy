package com.clenzy.payment;

import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;

/** Émission/relecture canonique d'une décision persistée. Aucun accès SQL ni transaction englobante. */
@Service
public class ManagedStripeRefund {
    private final StripeGateway stripe;
    public ManagedStripeRefund(StripeGateway stripe) { this.stripe = stripe; }

    public PaymentResult execute(RefundContext context, BigDecimal amount) throws com.stripe.exception.StripeException {
        return execute(context, amount, false, null);
    }

    /** Montant de politique figé côté serveur, pour une seule dette de réservation. */
    public PaymentResult executeCancellation(RefundContext context, BigDecimal amount) throws com.stripe.exception.StripeException {
        return execute(context, amount, true, null);
    }

    /** Les montants autorisés viennent exclusivement des parts et décisions persistées côté serveur. */
    public PaymentResult executeAllocation(RefundContext context, BigDecimal amount, Map<String, BigDecimal> decisions)
            throws com.stripe.exception.StripeException {
        require(decisions != null && amount != null && decisions.get(context.refundTransactionRef()) != null
                && amount.compareTo(decisions.get(context.refundTransactionRef())) == 0,
                "Décision d'allocation absente");
        return execute(context, amount, false, decisions);
    }

    public PaymentResult executeSeries(RefundContext context, BigDecimal amount, Map<String, BigDecimal> decisions,
            Map<String, BigDecimal> external) throws com.stripe.exception.StripeException {
        require(decisions!=null && amount!=null && amount.compareTo(decisions.getOrDefault(context.refundTransactionRef(),BigDecimal.ZERO))==0,
                "Décision de remboursement absente");
        return execute(context,amount,false,decisions,external);
    }

    /** Rejeu d'une preuve déjà confirmée : aucun besoin de réserver de nouveau le budget de la série. */
    public PaymentResult observeConfirmed(RefundContext context, BigDecimal amount) throws com.stripe.exception.StripeException {
        require(context.providerRefundId()!=null, "Preuve confirmée absente ; aucune émission autorisée");
        return execute(context,amount,true,null,null,true);
    }

    private PaymentResult execute(RefundContext context, BigDecimal amount, boolean cancellation,
            Map<String, BigDecimal> decisions) throws com.stripe.exception.StripeException {
        return execute(context,amount,cancellation,decisions,null);
    }

    private PaymentResult execute(RefundContext context, BigDecimal amount, boolean cancellation,
            Map<String, BigDecimal> decisions, Map<String, BigDecimal> external) throws com.stripe.exception.StripeException {
        return execute(context,amount,cancellation,decisions,external,false);
    }

    private PaymentResult execute(RefundContext context, BigDecimal amount, boolean cancellation,
            Map<String, BigDecimal> decisions, Map<String, BigDecimal> external, boolean observeOnly) throws com.stripe.exception.StripeException {
        require(context.refundTransactionRef() != null && context.requestedAt() != null, "Décision durable de remboursement absente");
        require(amount != null && amount.signum() > 0 && context.originalAmount() != null
                && (cancellation || decisions != null ? amount.compareTo(context.originalAmount()) <= 0 : amount.compareTo(context.originalAmount()) == 0),
                "Une allocation est nécessaire pour ce remboursement");
        require(context.providerTxId().startsWith("cs_"), "La session du paiement doit être rapprochée");
        var session = stripe.retrieveSession(context.providerTxId());
        long minor = StripeAmounts.toMinorUnits(amount);
        require(session != null && context.providerTxId().equals(session.getId()) && "payment".equals(session.getMode())
                && "complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
                && Objects.equals(session.getAmountTotal(), StripeAmounts.toMinorUnits(context.originalAmount())) && session.getCurrency() != null
                && context.currency().equalsIgnoreCase(session.getCurrency()) && session.getPaymentIntent() != null
                && session.getMetadata() != null
                && context.originalTransactionRef().equals(session.getMetadata().get("transactionRef")),
                "La preuve Stripe ne correspond pas à l'encaissement Baitly");
        String intent = session.getPaymentIntent();
        Refund refund = observeOnly ? stripe.retrieveRefund(context.providerRefundId())
                : external!=null ? findSeriesRefund(context,intent,decisions,external)
                : decisions != null ? findAllocationRefund(context, intent, decisions)
                : cancellation ? stripe.findExclusivePaymentRefund(intent, context.refundTransactionRef()) : context.providerRefundId() == null
                ? stripe.findPaymentRefund(intent, context.refundTransactionRef())
                : stripe.retrieveRefund(context.providerRefundId());
        if (refund == null) {
            require(context.providerRefundId() == null, "La preuve Stripe attendue est introuvable ; aucune nouvelle émission");
            // Après 23 h, l'absence dans la liste ne permet pas de recréer une opération
            // avec une clé potentiellement expirée. La décision reste à rapprocher.
            require(context.requestedAt().isAfter(LocalDateTime.now().minusHours(23)),
                    "Délai de reprise automatique dépassé : rapprochement Stripe requis");
            // Un litige peut arriver après la décision locale, avant sa reprise par le worker.
            // Les preuves déjà émises restent rapprochables ; seule une nouvelle émission est bloquée.
            var paymentIntent = stripe.retrievePaymentIntent(intent);
            require(paymentIntent != null && intent.equals(paymentIntent.getId())
                    && paymentIntent.getLatestCharge() != null, "Charge du remboursement introuvable");
            var charge = stripe.retrieveCharge(paymentIntent.getLatestCharge());
            require(charge != null && paymentIntent.getLatestCharge().equals(charge.getId())
                    && intent.equals(charge.getPaymentIntent()) && Boolean.TRUE.equals(charge.getPaid())
                    && charge.getDisputed()!=null
                    && charge.getLivemode()!=null && Objects.equals(charge.getLivemode(), session.getLivemode())
                    && Objects.equals(charge.getAmount(), session.getAmountTotal())
                    && context.currency().equalsIgnoreCase(charge.getCurrency()),
                    "Charge contestée ou incohérente : rapprochement requis avant remboursement");
            requireDisputeReleased(charge);
            var params = RefundCreateParams.builder().setPaymentIntent(intent).setAmount(minor)
                    .setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER)
                    .putAllMetadata(Map.of("baitly_refund_ref", context.refundTransactionRef(),
                            "originalTransactionRef", context.originalTransactionRef(),
                            "organizationId", context.orgId().toString())).build();
            refund = stripe.createRefund(params, "baitly-refund-" + context.refundTransactionRef());
            require(refund != null && refund.getId() != null, "Réponse de remboursement absente");
            // Une réponse idempotente peut conserver pending alors que l'objet courant a changé.
            refund = stripe.retrieveRefund(refund.getId());
        }
        require(refund != null && refund.getId() != null
                && (context.providerRefundId() == null || context.providerRefundId().equals(refund.getId()))
                && Objects.equals(refund.getPaymentIntent(), intent)
                && Objects.equals(refund.getAmount(), minor) && context.currency().equalsIgnoreCase(refund.getCurrency())
                && refund.getMetadata() != null
                && context.refundTransactionRef().equals(refund.getMetadata().get("baitly_refund_ref"))
                && context.originalTransactionRef().equals(refund.getMetadata().get("originalTransactionRef"))
                && context.orgId().toString().equals(refund.getMetadata().get("organizationId")),
                "Preuve de remboursement incohérente");
        if ("succeeded".equals(refund.getStatus())) return PaymentResult.success(refund.getId(), null, "REFUNDED");
        String status = "failed".equals(refund.getStatus()) || "canceled".equals(refund.getStatus())
                ? "REFUND_REJECTED" : "REFUND_PENDING";
        return new PaymentResult(false, refund.getId(), null, null, null, status,
                "REFUND_REJECTED".equals(status) ? "Remboursement refusé par Stripe : " + refund.getStatus()
                        : "Remboursement en attente de confirmation Stripe");
    }

    private Refund findAllocationRefund(RefundContext context, String intent, Map<String, BigDecimal> decisions)
            throws com.stripe.exception.StripeException {
        require(decisions.values().stream().allMatch(a -> a != null && a.signum() > 0)
                && decisions.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(context.originalAmount()) <= 0,
                "Cumul des parts à rembourser incohérent");
        Refund found = null;
        var seen = new java.util.HashSet<String>();
        for (var refund : stripe.listPaymentRefunds(intent)) {
            var metadata = refund.getMetadata();
            String ref = metadata == null ? null : metadata.get("baitly_refund_ref");
            BigDecimal expected = ref == null ? null : decisions.get(ref);
            require(expected != null && seen.add(ref) && metadata != null
                    && Objects.equals(refund.getPaymentIntent(), intent)
                    && Objects.equals(refund.getAmount(), StripeAmounts.toMinorUnits(expected))
                    && context.currency().equalsIgnoreCase(refund.getCurrency())
                    && context.orgId().toString().equals(metadata.get("organizationId"))
                    && context.originalTransactionRef().equals(metadata.get("originalTransactionRef")),
                    "Un remboursement Stripe externe ou incohérent doit être rapproché avant de rembourser cette part");
            if (context.refundTransactionRef().equals(ref)) found = refund;
        }
        return found;
    }

    private Refund findSeriesRefund(RefundContext context, String intent, Map<String, BigDecimal> decisions,
            Map<String, BigDecimal> external) throws com.stripe.exception.StripeException {
        var amounts=new java.util.ArrayList<BigDecimal>(decisions.values()); amounts.addAll(external.values());
        require(amounts.stream().allMatch(a -> a!=null && a.signum()>0)
                && amounts.stream().reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(context.originalAmount())<=0,
                "Cumul des restitutions supérieur à l'encaissement");
        var seen=new java.util.HashSet<String>(); var externalSeen=new java.util.HashSet<String>(); Refund found=null;
        for(var refund:stripe.listPaymentRefunds(intent)) {
            require(refund.getId()!=null && Objects.equals(refund.getPaymentIntent(),intent)
                    && context.currency().equalsIgnoreCase(refund.getCurrency()),"Remboursement d'un autre encaissement");
            if(external.containsKey(refund.getId())) {
                require(externalSeen.add(refund.getId()) && "succeeded".equals(refund.getStatus())
                        && Objects.equals(refund.getAmount(),StripeAmounts.toMinorUnits(external.get(refund.getId()))),
                        "Preuve de remboursement externe incohérente");
                continue;
            }
            var metadata=refund.getMetadata(); String ref=metadata==null?null:metadata.get("baitly_refund_ref");
            require(ref!=null && decisions.containsKey(ref) && seen.add(ref)
                    && Objects.equals(refund.getAmount(),StripeAmounts.toMinorUnits(decisions.get(ref)))
                    && context.originalTransactionRef().equals(metadata.get("originalTransactionRef"))
                    && context.orgId().toString().equals(metadata.get("organizationId")),"Remboursement Stripe non rapproché");
            if(context.refundTransactionRef().equals(ref)) found=refund;
            else require("succeeded".equals(refund.getStatus()),"Remboursement précédent non confirmé");
        }
        require(externalSeen.equals(external.keySet()) && decisions.keySet().stream()
                .allMatch(ref -> ref.equals(context.refundTransactionRef()) || seen.contains(ref)),
                "Une preuve de remboursement antérieure est introuvable");
        return found;
    }

    private void requireDisputeReleased(com.stripe.model.Charge charge) throws com.stripe.exception.StripeException {
        if(Boolean.FALSE.equals(charge.getDisputed())) return;
        // Le marqueur disputed reste vrai après victoire : vérifier l'issue ET la restitution.
        var disputes=stripe.disputesForCharge(charge.getId());
        require(!disputes.isEmpty(),"Charge contestée : dossier Stripe introuvable");
        for(var dispute:disputes) {
            require(Objects.equals(dispute.getCharge(),charge.getId())
                    && Objects.equals(dispute.getPaymentIntent(),charge.getPaymentIntent())
                    && Objects.equals(dispute.getLivemode(),charge.getLivemode())
                    && Objects.equals(dispute.getCurrency(),charge.getCurrency())
                    && java.util.Set.of("won","warning_closed").contains(Objects.toString(dispute.getStatus(),""))
                    && Boolean.TRUE.equals(dispute.getIsChargeRefundable()),
                    "Charge contestée : issue ou droit de remboursement à rapprocher");
            long principal=0; boolean credit=false; var seen=new java.util.HashSet<String>();
            for(var movement:dispute.getBalanceTransactions()==null?java.util.List.<com.stripe.model.BalanceTransaction>of():dispute.getBalanceTransactions()) {
                require(movement.getId()!=null && seen.add(movement.getId()) && movement.getAmount()!=null
                        && Objects.equals(movement.getCurrency(),charge.getCurrency()),"Mouvement de litige incohérent");
                principal=Math.addExact(principal,movement.getAmount());
                credit |= movement.getAmount()>0;
            }
            require(principal==0 && (!"won".equals(dispute.getStatus()) || credit),"Charge contestée : fonds non restitués");
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }
}
