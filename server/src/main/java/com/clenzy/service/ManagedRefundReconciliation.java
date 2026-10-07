package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.stripe.model.Refund;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.Objects;

/** Reprise des décisions Baitly après crash ou réponse pending. Le réseau reste hors transaction SQL. */
@Service
public class ManagedRefundReconciliation {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ManagedRefundReconciliation.class);
    private final PaymentTransactionRepository payments;
    private final PaymentPersistence persistence;
    private final ManagedStripeRefund stripe;
    private final BaitlyBatchRefundPersistence batchRefunds;
    private final BaitlyExternalRefundReconciliation externalRefunds;
    private final com.clenzy.booking.service.BookingCancellationRefundProcessor bookingRefunds;
    public ManagedRefundReconciliation(PaymentTransactionRepository payments, PaymentPersistence persistence,
            ManagedStripeRefund stripe, com.clenzy.booking.service.BookingCancellationRefundProcessor bookingRefunds,
            BaitlyBatchRefundPersistence batchRefunds, BaitlyExternalRefundReconciliation externalRefunds) {
        this.externalRefunds = externalRefunds;
        this.batchRefunds = batchRefunds;
        this.bookingRefunds = bookingRefunds;
        this.payments = payments; this.persistence = persistence; this.stripe = stripe;
    }

    /** L'événement signé déclenche une relecture ; ses montants et statuts ne font pas foi. */
    public void onWebhook(Refund incoming) throws com.stripe.exception.StripeException {
        if (incoming == null || incoming.getId() == null) throw new IllegalArgumentException("Objet remboursement absent");
        bookingRefunds.onWebhook(incoming);
        String ref = incoming.getMetadata() == null ? null : incoming.getMetadata().get("baitly_refund_ref");
        var tx = ref == null ? payments.findByProviderTxId(incoming.getId()).orElse(null)
                : payments.findByTransactionRef(ref).orElse(null);
        if (tx == null || !PaymentPersistence.managedRefund(tx)) {
            externalRefunds.onWebhook(incoming);
            return;
        }
        if (tx.getProviderTxId() != null && !tx.getProviderTxId().equals(incoming.getId())) {
            throw new IllegalStateException("Référence Stripe d'un autre remboursement");
        }
        reconcile(tx, incoming.getId());
    }

    @Scheduled(initialDelayString = "${baitly.payments.refund-check-ms:60000}",
            fixedDelayString = "${baitly.payments.refund-check-ms:60000}")
    @SchedulerLock(name = "baitly-managed-refunds", lockAtMostFor = "PT10M")
    public void resumePending() {
        for (var tx : payments.findPendingStripeRefunds(PageRequest.of(0, 20))) {
            if (!PaymentPersistence.managedRefund(tx)) continue;
            try { reconcile(tx, tx.getProviderTxId()); }
            catch (Exception failure) {
                persistence.markRefundFailed(tx.getTransactionRef(), failure.getMessage());
                log.warn("Remboursement {} à rapprocher : {}", tx.getTransactionRef(), failure.getMessage());
            }
        }
    }

    /** Appel réseau hors transaction SQL ; un timeout garde la part réservée pour le worker. */
    public PaymentTransaction resumeAllocation(String ref, Long org) {
        return resume(ref,org,false);
    }

    public PaymentTransaction resumeSeries(String ref,Long org) { return resume(ref,org,true); }

    private PaymentTransaction resume(String ref, Long org, boolean series) {
        var tx = payments.findByTransactionRef(ref).orElseThrow();
        if (!PaymentPersistence.managedRefund(tx) || !Objects.equals(org, tx.getOrganizationId())
                || !(series?BaitlyRefundSeries.isSeries(tx):BaitlyBatchRefundPersistence.isAllocation(tx)))
            throw new IllegalStateException("Remboursement de part inaccessible");
        if (tx.getStatus() == TransactionStatus.COMPLETED || tx.getStatus() == TransactionStatus.FAILED
                || tx.getStatus() == TransactionStatus.CANCELLED) return tx;
        try { return reconcile(tx, tx.getProviderTxId()); }
        catch (Exception failure) { return persistence.markRefundFailed(ref, failure.getMessage()); }
    }

    PaymentTransaction reconcile(PaymentTransaction tx, String providerRefundId) throws com.stripe.exception.StripeException {
        if(!PaymentPersistence.managedRefund(tx)) throw new IllegalStateException("Une preuve externe ne peut pas émettre de remboursement");
        Object originalRef = tx.getMetadata().get("originalTransactionRef");
        if (!(originalRef instanceof String ref)) throw new IllegalStateException("Encaissement d'origine absent");
        var original = payments.findByTransactionRef(ref).orElseThrow();
        boolean allocated = BaitlyBatchRefundPersistence.isAllocation(tx);
        boolean series = BaitlyRefundSeries.isSeries(tx);
        if (allocated) batchRefunds.validate(tx, original);
        if (tx.getProviderType() != PaymentProviderType.STRIPE
                || original.getProviderType() != PaymentProviderType.STRIPE
                || original.getPaymentType() != TransactionType.CHECKOUT || original.getStatus() != TransactionStatus.COMPLETED
                || !Objects.equals(tx.getOrganizationId(), original.getOrganizationId())
                || !"INTERVENTION".equals(tx.getSourceType())
                || !Objects.equals(tx.getCurrency(), original.getCurrency())
                || (!allocated && (!Objects.equals(tx.getSourceType(), original.getSourceType())
                    || !Objects.equals(tx.getSourceId(), original.getSourceId())
                    || (series ? tx.getAmount().signum()<=0 || BaitlyRefundSeries.after(tx).compareTo(original.getAmount())>0
                        : tx.getAmount().compareTo(original.getAmount()) != 0)))) {
            throw new IllegalStateException("Remboursement et encaissement incohérents");
        }
        var context = new RefundContext(tx.getOrganizationId(), original.getProviderTxId(), ref, original.getCurrency(),
                original.getAmount(), tx.getTransactionRef(), providerRefundId, tx.getCreatedAt());
        PaymentResult result;
        if(series && tx.getStatus()==TransactionStatus.COMPLETED) {
            result=stripe.observeConfirmed(context,tx.getAmount());
        } else if(allocated) {
            var external=batchRefunds.externalManifest(original);
            result=external.isEmpty() ? stripe.executeAllocation(context,tx.getAmount(),batchRefunds.manifest(original))
                    : stripe.executeSeries(context,tx.getAmount(),batchRefunds.managedManifest(original),external);
        } else if(series) {
            var history=BaitlyRefundSeries.history(original,payments.findByOrganizationIdAndSourceTypeAndSourceId(
                    tx.getOrganizationId(),tx.getSourceType(),tx.getSourceId()));
            var decisions=new java.util.HashMap<String,java.math.BigDecimal>();
            var external=new java.util.HashMap<String,java.math.BigDecimal>();
            for(var row:history) {
                if(!row.getId().equals(tx.getId()) && row.getStatus()!=TransactionStatus.COMPLETED)
                    throw new IllegalStateException("Une autre restitution est encore en cours");
                if(BaitlyExternalRefundStore.confirmed(row)) external.put(row.getProviderTxId(),row.getAmount());
                else decisions.put(row.getTransactionRef(),row.getAmount());
            }
            result=stripe.executeSeries(context,tx.getAmount(),decisions,external);
        } else result = allocated ? stripe.executeAllocation(context, tx.getAmount(), batchRefunds.manifest(original))
                    : stripe.execute(context, tx.getAmount());
        if (tx.getStatus() == TransactionStatus.COMPLETED && !result.success()) {
            throw new IllegalStateException("Évolution tardive du remboursement : contre-écritures à rapprocher");
        }
        return persistence.finalizeRefund(tx.getTransactionRef(), result, tx.getOrganizationId());
    }
}
