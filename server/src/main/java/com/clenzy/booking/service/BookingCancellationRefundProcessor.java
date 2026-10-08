package com.clenzy.booking.service;

import com.clenzy.payment.ManagedStripeRefund;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.Refund;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Reprise autonome après commit : aucune dépendance à la présence du navigateur du voyageur. */
@Service
public class BookingCancellationRefundProcessor {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BookingCancellationRefundProcessor.class);
    private final PaymentTransactionRepository payments;
    private final BookingCancellationRefunds refunds;
    private final ManagedStripeRefund stripe;
    private final TenantScopedExecutor tenants;

    public BookingCancellationRefundProcessor(PaymentTransactionRepository payments, BookingCancellationRefunds refunds,
            ManagedStripeRefund stripe, TenantScopedExecutor tenants) {
        this.payments = payments; this.refunds = refunds; this.stripe = stripe; this.tenants = tenants;
    }

    @Scheduled(initialDelayString = "${baitly.payments.booking-refund-check-ms:60000}",
            fixedDelayString = "${baitly.payments.booking-refund-check-ms:60000}")
    @SchedulerLock(name = "baitly-booking-cancellation-refunds", lockAtMostFor = "PT10M")
    public void resume() {
        for (var candidate : payments.findPendingBookingCancellationRefunds(PageRequest.of(0, 20))) {
            try {
                tenants.runAsOrganization(candidate.getOrganizationId(),
                        () -> reconcile(candidate.getOrganizationId(), candidate.getTransactionRef()));
            } catch (RuntimeException failure) {
                log.warn("Annulation {} : dossier conservé pour rapprochement ({})",
                        candidate.getTransactionRef(), failure.getClass().getSimpleName());
            }
        }
    }

    /** Appel réservé au contrôleur qui a vérifié signature, version et compte plateforme. */
    public void onWebhook(Refund incoming) {
        if (incoming == null || incoming.getId() == null) return;
        String ref = incoming.getMetadata() == null ? null : incoming.getMetadata().get("baitly_refund_ref");
        var stored = ref == null ? payments.findByProviderTxId(incoming.getId()).orElse(null)
                : payments.findByTransactionRef(ref).orElse(null);
        if (stored == null || !BookingCancellationRefunds.SOURCE.equals(stored.getSourceType())) return;
        if (stored.getProviderTxId() != null && !incoming.getId().equals(stored.getProviderTxId()))
            throw new IllegalStateException("Événement d'un autre remboursement");
        tenants.runAsOrganization(stored.getOrganizationId(), () -> reconcile(stored.getOrganizationId(), stored.getTransactionRef(), incoming.getId()));
    }

    void reconcile(Long org, String ref) {
        reconcile(org, ref, null);
    }

    private void reconcile(Long org, String ref, String webhookRefundId) {
        try {
            var decision = refunds.load(org, ref);
            var context = decision.context();
            if (webhookRefundId != null) context = new com.clenzy.payment.RefundContext(context.orgId(),
                    context.providerTxId(), context.originalTransactionRef(), context.currency(), context.originalAmount(),
                    context.refundTransactionRef(), webhookRefundId, context.requestedAt());
            var result = decision.confirmed() ? stripe.observeConfirmed(context, decision.amount())
                    : stripe.executeCancellation(context, decision.amount());
            refunds.apply(org, ref, result);
        } catch (Exception failure) {
            refunds.recordFailure(org, ref);
            throw new IllegalStateException("Remboursement de réservation à rapprocher", failure);
        }
    }
}
