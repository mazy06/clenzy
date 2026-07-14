package com.clenzy.service;

import com.clenzy.booking.service.BookingBalanceService;
import com.clenzy.service.ai.AiCreditPurchaseService;

/**
 * Source de vérité <strong>unique</strong> des {@code sourceType} dont la
 * réconciliation d'entité métier est portée par le consumer Kafka
 * {@code PAYMENT_COMPLETED} (ADR paiement multi-provider, Vagues 2/5) — et
 * <em>non</em> par le dispatch legacy du webhook Stripe.
 *
 * <p>Historiquement cette liste était dupliquée à deux endroits qui devaient
 * rester d'accord (la garde {@code StripeWebhookController.isOrchestratedTotalPayment}
 * et le dispatch {@code PaymentEventConsumer.handlePaymentCompleted}) — un
 * couplage propice au « shotgun surgery ». On la centralise ici : la garde
 * webhook délègue à ce prédicat, et le consumer s'en sert pour détecter une
 * incohérence (type déclaré ici mais non dispatché).</p>
 */
public final class ConsumerReconciledSourceTypes {

    private ConsumerReconciledSourceTypes() {
    }

    /**
     * Vrai si le flux de ce {@code sourceType} est réconcilié par le consumer
     * {@code PAYMENT_COMPLETED} (et doit donc court-circuiter le dispatch legacy
     * du webhook Stripe). {@code null} → {@code false}.
     */
    public static boolean isReconciledByConsumer(String sourceType) {
        if (sourceType == null) {
            return false;
        }
        return sourceType.startsWith(DeferredPaymentService.SOURCE_TYPE_PREFIX)
            || ReservationPaymentService.SOURCE_TYPE.equals(sourceType)
            || BookingBalanceService.SOURCE_TYPE.equals(sourceType)
            || AiCreditPurchaseService.SOURCE_TYPE.equals(sourceType)
            || ServiceRequestPaymentService.SOURCE_TYPE.equals(sourceType)
            || UpsellService.SOURCE_TYPE.equals(sourceType);
    }
}
