package com.clenzy.payment.provider;

import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caractérise les capacités déclarées par chaque {@link PaymentProvider}.
 *
 * <p>Le resolver ({@code PaymentOrchestrationService}) s'appuie dessus pour ne
 * jamais router un flux (caution, payout, card-on-file) vers un provider qui ne
 * le supporte pas. Les capacités ne dépendent d'aucune dépendance runtime — on
 * instancie donc les providers avec des dépendances nulles.</p>
 */
class PaymentProviderCapabilitiesTest {

    @Test
    @DisplayName("Stripe couvre toutes les capacités (PAY, PREAUTH, REFUND, PAYOUT, CUSTOMER)")
    void stripeSupportsEverything() {
        PaymentProvider stripe = new StripePaymentProvider();

        assertThat(stripe.getCapabilities()).containsExactlyInAnyOrder(
                PaymentCapability.PAY, PaymentCapability.PREAUTH, PaymentCapability.REFUND,
                PaymentCapability.PAYOUT, PaymentCapability.CUSTOMER, PaymentCapability.EMBEDDED_CHECKOUT,
                PaymentCapability.SHIPPING_ADDRESS);
        assertThat(stripe.supports(PaymentCapability.PREAUTH)).isTrue();
        assertThat(stripe.supports(PaymentCapability.PAYOUT)).isTrue();
        assertThat(stripe.supports(PaymentCapability.EMBEDDED_CHECKOUT)).isTrue();
        assertThat(stripe.supports(PaymentCapability.SHIPPING_ADDRESS)).isTrue();
    }

    @Test
    @DisplayName("PayZone : PAY + REFUND seulement (pas de payout, card-on-file, pré-auth)")
    void payzoneSupportsPayAndRefundOnly() {
        PaymentProvider payzone = new PayzonePaymentProvider(null, null);
        assertPayAndRefundOnly(payzone);
    }

    @Test
    @DisplayName("PayTabs : PAY + REFUND seulement")
    void payTabsSupportsPayAndRefundOnly() {
        PaymentProvider paytabs = new PayTabsPaymentProvider(null, null);
        assertPayAndRefundOnly(paytabs);
    }

    @Test
    @DisplayName("CMI : PAY seulement (refund = back-office manuel, pas d'API)")
    void cmiSupportsPayOnly() {
        PaymentProvider cmi = new CmiPaymentProvider(null, null);
        assertThat(cmi.getCapabilities()).containsExactly(PaymentCapability.PAY);
        assertThat(cmi.supports(PaymentCapability.PAY)).isTrue();
        // CMI ne rembourse pas via le port (refundPayment renvoie un échec) →
        // REFUND ne doit PAS être déclarée (honnêteté des capacités).
        assertThat(cmi.supports(PaymentCapability.REFUND)).isFalse();
        assertThat(cmi.supports(PaymentCapability.PAYOUT)).isFalse();
    }

    @Test
    @DisplayName("Tout provider supporte au minimum PAY")
    void everyProviderSupportsPay() {
        assertThat(new StripePaymentProvider().supports(PaymentCapability.PAY)).isTrue();
        assertThat(new PayzonePaymentProvider(null, null).supports(PaymentCapability.PAY)).isTrue();
        assertThat(new PayTabsPaymentProvider(null, null).supports(PaymentCapability.PAY)).isTrue();
        assertThat(new CmiPaymentProvider(null, null).supports(PaymentCapability.PAY)).isTrue();
    }

    private void assertPayAndRefundOnly(PaymentProvider provider) {
        assertThat(provider.getCapabilities())
                .containsExactlyInAnyOrder(PaymentCapability.PAY, PaymentCapability.REFUND);
        assertThat(provider.supports(PaymentCapability.PAY)).isTrue();
        assertThat(provider.supports(PaymentCapability.REFUND)).isTrue();
        assertThat(provider.supports(PaymentCapability.PREAUTH)).isFalse();
        assertThat(provider.supports(PaymentCapability.PAYOUT)).isFalse();
        assertThat(provider.supports(PaymentCapability.CUSTOMER)).isFalse();
    }
}
