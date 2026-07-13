package com.clenzy.service;

import com.clenzy.booking.service.BookingBalanceService;
import com.clenzy.service.ai.AiCreditPurchaseService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caractérise la source de vérité unique des sourceTypes réconciliés par le
 * consumer PAYMENT_COMPLETED (partagée par la garde webhook et le consumer).
 */
class ConsumerReconciledSourceTypesTest {

    @Test
    @DisplayName("les flux orchestrés « payer un total » + périphérie sont reconnus")
    void recognisesConsumerReconciledFlows() {
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(
                DeferredPaymentService.SOURCE_TYPE_PREFIX + "HOST")).isTrue();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(ReservationPaymentService.SOURCE_TYPE)).isTrue();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(BookingBalanceService.SOURCE_TYPE)).isTrue();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(AiCreditPurchaseService.SOURCE_TYPE)).isTrue();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(ServiceRequestPaymentService.SOURCE_TYPE)).isTrue();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(UpsellService.SOURCE_TYPE)).isTrue();
    }

    @Test
    @DisplayName("les flux à complétion webhook legacy + null ne sont PAS reconnus")
    void rejectsWebhookAndNull() {
        // INTERVENTION unitaire et BOOKING_CHECKOUT se complètent par le webhook legacy Stripe.
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer("INTERVENTION")).isFalse();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer("BOOKING_CHECKOUT")).isFalse();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer("HARDWARE_ORDER")).isFalse();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer("")).isFalse();
        assertThat(ConsumerReconciledSourceTypes.isReconciledByConsumer(null)).isFalse();
    }
}
