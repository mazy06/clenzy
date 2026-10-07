package com.clenzy.payment;

import com.stripe.exception.StripeException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;

/** Lecture réseau explicite des preuves sandbox. Aucune écriture Stripe ou base PMS. */
@EnabledIfEnvironmentVariable(named = "BAITLY_STRIPE_SANDBOX_READ", matches = "true")
class StripeSandboxReadIT {
    @Test
    void currentGatewayReadsPaymentTransferAndManualPayoutEvidence() {
        String key = required("BAITLY_STRIPE_SANDBOX_KEY");
        assertThat(key.matches("(?:sk|rk)_test_[A-Za-z0-9]+"))
                .as("Une clé test est obligatoire").isTrue();
        var gateway = new StripeGateway(key);
        try {
            var platform = gateway.retrieveAccount(required("BAITLY_STRIPE_SANDBOX_PLATFORM"));
            assertThat(platform.getId()).isEqualTo(required("BAITLY_STRIPE_SANDBOX_PLATFORM"));
            assertThat(platform.getCountry()).isEqualTo("FR");
            assertThat(gateway.retrievePlatformBalance().getLivemode()).isFalse();

            var payment = gateway.retrievePaymentIntent(required("BAITLY_STRIPE_TEST_PAYMENT"));
            assertThat(payment.getLivemode()).isFalse();
            assertThat(payment.getStatus()).isEqualTo("succeeded");
            assertThat(payment.getAmountReceived()).isEqualTo(10000L);
            assertThat(payment.getMetadata().get("baitly_sandbox_recipe")).isEqualTo(required("BAITLY_STRIPE_TEST_RUN"));

            var transfer = gateway.retrieveTransfer(required("BAITLY_STRIPE_TEST_TRANSFER"));
            assertThat(transfer.getLivemode()).isFalse();
            assertThat(transfer.getAmount()).isEqualTo(3000L);
            assertThat(transfer.getAmountReversed()).isEqualTo(500L);
            assertThat(transfer.getDestination()).isEqualTo(required("BAITLY_STRIPE_TEST_BENEFICIARY"));
            assertThat(transfer.getSourceTransaction()).isEqualTo(payment.getLatestCharge());
            assertThat(transfer.getDestinationPayment()).isNotBlank();

            var payout = gateway.retrieveConnectedPayout(required("BAITLY_STRIPE_TEST_BENEFICIARY"),
                    required("BAITLY_STRIPE_TEST_PAYOUT"));
            assertThat(payout.getLivemode()).isFalse();
            assertThat(payout.getStatus()).isEqualTo("paid");
            assertThat(payout.getAmount()).isEqualTo(500L);
            assertThat(payout.getAutomatic()).as("Un payout manuel ne prouve pas le rapprochement automatique").isFalse();
        } catch (StripeException error) {
            // Ne pas joindre la réponse brute ou un client_secret au rapport Surefire.
            throw new AssertionError("Stripe sandbox : HTTP " + error.getStatusCode() + ", code " + error.getCode());
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        assertThat(value != null && !value.isBlank()).as("Variable requise : %s", name).isTrue();
        return value;
    }
}
