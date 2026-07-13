package com.clenzy.payment.provider;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.CustomerRequest;
import com.clenzy.payment.PaymentRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.PayoutRequest;
import com.stripe.exception.ApiException;
import com.stripe.model.Customer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Payout;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PayoutCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link StripePaymentProvider}.
 *
 * Strategie : mocke les statics de Stripe SDK (Session.create, PaymentIntent.retrieve,
 * Refund.create, Customer.create, Payout.create, Webhook.constructEvent) via Mockito.
 */
class StripePaymentProviderTest {

    private StripePaymentProvider provider;

    @BeforeEach
    void setUp() {
        provider = new StripePaymentProvider();
        ReflectionTestUtils.setField(provider, "secretKey", "sk_test_xxx");
        ReflectionTestUtils.setField(provider, "webhookSecret", "whsec_xxx");
        ReflectionTestUtils.setField(provider, "defaultSuccessUrl", "https://default-success");
        ReflectionTestUtils.setField(provider, "defaultCancelUrl", "https://default-cancel");
    }

    @Test
    void getProviderType_returnsStripe() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.STRIPE);
    }

    @Test
    void getSupportedCountries_includesFranceAndMoroccoAndSaudi() {
        assertThat(provider.getSupportedCountries()).contains("FR", "MA", "SA", "*");
    }

    @Test
    void getSupportedCurrencies_includesMajorOnes() {
        assertThat(provider.getSupportedCurrencies()).contains("EUR", "MAD", "SAR", "USD", "GBP");
    }

    // ── createPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPayment")
    class CreatePayment {
        @Test
        void success_returnsResultWithSessionIdAndUrl() {
            PaymentRequest request = new PaymentRequest(
                    new BigDecimal("100.00"), "EUR", "Test", "u@e.com", "U",
                    "https://success", "https://cancel", "idem-1", Map.of("k", "v"));
            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_test_xxx");
            when(session.getUrl()).thenReturn("https://checkout.stripe.com/cs_test_xxx");

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any()))
                        .thenReturn(session);

                PaymentResult result = provider.createPayment(request);

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("cs_test_xxx");
                assertThat(result.redirectUrl()).isEqualTo("https://checkout.stripe.com/cs_test_xxx");
            }
        }

        @Test
        void embedded_returnsClientSecretInsteadOfRedirect() {
            PaymentRequest request = new PaymentRequest(
                    new BigDecimal("250.00"), "EUR", "Séjour", "u@e.com", null,
                    null, null, "idem-emb", Map.of("type", "booking_engine"),
                    true, 1_900_000_000L, true);
            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_emb");
            when(session.getClientSecret()).thenReturn("cs_emb_secret");

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any()))
                        .thenReturn(session);

                PaymentResult result = provider.createPayment(request);

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("cs_emb");
                assertThat(result.clientSecret()).isEqualTo("cs_emb_secret");
                assertThat(result.redirectUrl()).isNull();
            }
        }

        @Test
        void embedded_declaresCapability() {
            assertThat(provider.getCapabilities())
                    .contains(com.clenzy.payment.PaymentCapability.EMBEDDED_CHECKOUT);
        }

        @Test
        void successUrlBlank_fallsBackToDefault() {
            PaymentRequest request = new PaymentRequest(
                    BigDecimal.TEN, "EUR", "T", "u@e.com", "U",
                    "", "", null, null);
            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_2");
            when(session.getUrl()).thenReturn("https://stripe/cs_2");

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any()))
                        .thenReturn(session);

                PaymentResult result = provider.createPayment(request);

                assertThat(result.success()).isTrue();
            }
        }

        @Test
        void successUrlNull_fallsBackToDefault() {
            PaymentRequest request = new PaymentRequest(
                    BigDecimal.TEN, "EUR", null, null, null,
                    null, null, null, null);
            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_3");
            when(session.getUrl()).thenReturn("u");

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any()))
                        .thenReturn(session);

                PaymentResult result = provider.createPayment(request);

                assertThat(result.success()).isTrue();
            }
        }

        @Test
        void stripeException_returnsFailureResult() {
            PaymentRequest request = new PaymentRequest(
                    BigDecimal.TEN, "EUR", "T", "u@e.com", "U", "s", "c", null, null);

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any()))
                        .thenThrow(new ApiException("API down", null, "code", 500, null));

                PaymentResult result = provider.createPayment(request);

                assertThat(result.success()).isFalse();
                assertThat(result.errorMessage()).contains("Stripe error");
            }
        }
    }

    // ── capturePayment ────────────────────────────────────────────────────

    @Nested
    @DisplayName("capturePayment")
    class CapturePayment {
        @Test
        void success_returnsCaptured() throws Exception {
            PaymentIntent intent = mock(PaymentIntent.class);
            when(intent.capture(any(java.util.Map.class))).thenReturn(intent);

            try (MockedStatic<PaymentIntent> intentStatic = mockStatic(PaymentIntent.class)) {
                intentStatic.when(() -> PaymentIntent.retrieve(eq("pi_test"), any()))
                        .thenReturn(intent);

                PaymentResult result = provider.capturePayment("pi_test", new BigDecimal("50"));

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("pi_test");
                assertThat(result.status()).isEqualTo("CAPTURED");
            }
        }

        @Test
        void stripeException_returnsFailure() {
            try (MockedStatic<PaymentIntent> intentStatic = mockStatic(PaymentIntent.class)) {
                intentStatic.when(() -> PaymentIntent.retrieve(anyString(), any()))
                        .thenThrow(new ApiException("not found", null, "c", 404, null));

                PaymentResult result = provider.capturePayment("pi_bad", BigDecimal.ONE);

                assertThat(result.success()).isFalse();
                assertThat(result.errorMessage()).contains("Stripe capture error");
            }
        }
    }

    // ── refundPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {
        @Test
        void fullRefund_returnsResult() {
            Refund refund = mock(Refund.class);
            when(refund.getId()).thenReturn("rf_test");

            try (MockedStatic<Refund> refundStatic = mockStatic(Refund.class)) {
                refundStatic.when(() -> Refund.create(any(RefundCreateParams.class), any()))
                        .thenReturn(refund);

                PaymentResult result = provider.refundPayment("pi_xxx", null, null);

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("rf_test");
                assertThat(result.status()).isEqualTo("REFUNDED");
            }
        }

        @Test
        void partialRefund_succeeds() {
            Refund refund = mock(Refund.class);
            when(refund.getId()).thenReturn("rf_partial");

            try (MockedStatic<Refund> refundStatic = mockStatic(Refund.class)) {
                refundStatic.when(() -> Refund.create(any(RefundCreateParams.class), any()))
                        .thenReturn(refund);

                PaymentResult result = provider.refundPayment("pi_xxx", new BigDecimal("25.00"), "Customer change");

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("rf_partial");
            }
        }

        @Test
        void stripeException_returnsFailure() {
            try (MockedStatic<Refund> refundStatic = mockStatic(Refund.class)) {
                refundStatic.when(() -> Refund.create(any(RefundCreateParams.class), any()))
                        .thenThrow(new ApiException("Refund failed", null, "c", 400, null));

                PaymentResult result = provider.refundPayment("pi_bad", null, null);

                assertThat(result.success()).isFalse();
                assertThat(result.errorMessage()).contains("Stripe refund error");
            }
        }
    }

    // ── createCustomer ────────────────────────────────────────────────────

    @Nested
    @DisplayName("createCustomer")
    class CreateCustomer {
        @Test
        void success_returnsCustomerId() {
            CustomerRequest request = new CustomerRequest("e@x.com", "John", "FR", "+33");
            Customer customer = mock(Customer.class);
            when(customer.getId()).thenReturn("cus_test");

            try (MockedStatic<Customer> customerStatic = mockStatic(Customer.class)) {
                customerStatic.when(() -> Customer.create(any(CustomerCreateParams.class), any()))
                        .thenReturn(customer);

                String id = provider.createCustomer(request);

                assertThat(id).isEqualTo("cus_test");
            }
        }

        @Test
        void stripeException_throwsRuntimeException() {
            CustomerRequest request = new CustomerRequest("e@x.com", "John", "FR", "+33");

            try (MockedStatic<Customer> customerStatic = mockStatic(Customer.class)) {
                customerStatic.when(() -> Customer.create(any(CustomerCreateParams.class), any()))
                        .thenThrow(new ApiException("create failed", null, "c", 500, null));

                assertThatThrownBy(() -> provider.createCustomer(request))
                        .isInstanceOf(RuntimeException.class)
                        .hasMessageContaining("Stripe customer creation failed");
            }
        }
    }

    // ── createPayout ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPayout")
    class CreatePayout {
        @Test
        void success_returnsPayoutCreated() {
            PayoutRequest request = new PayoutRequest(
                    new BigDecimal("200"), "EUR", "acct_test", "Payout test", Map.of());
            Payout payout = mock(Payout.class);
            when(payout.getId()).thenReturn("po_test");

            try (MockedStatic<Payout> payoutStatic = mockStatic(Payout.class)) {
                payoutStatic.when(() -> Payout.create(any(PayoutCreateParams.class), any()))
                        .thenReturn(payout);

                PaymentResult result = provider.createPayout(request);

                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("po_test");
                assertThat(result.status()).isEqualTo("PAYOUT_CREATED");
            }
        }

        @Test
        void stripeException_returnsFailure() {
            PayoutRequest request = new PayoutRequest(
                    BigDecimal.ONE, "EUR", "acct_x", "p", Map.of());

            try (MockedStatic<Payout> payoutStatic = mockStatic(Payout.class)) {
                payoutStatic.when(() -> Payout.create(any(PayoutCreateParams.class), any()))
                        .thenThrow(new ApiException("payout failed", null, "c", 500, null));

                PaymentResult result = provider.createPayout(request);

                assertThat(result.success()).isFalse();
                assertThat(result.errorMessage()).contains("Stripe payout error");
            }
        }
    }

    // ── verifyWebhook ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyWebhook")
    class VerifyWebhook {
        @Test
        void validSignature_returnsTrue() {
            try (MockedStatic<Webhook> webhookStatic = mockStatic(Webhook.class)) {
                webhookStatic.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(null);

                boolean valid = provider.verifyWebhook("payload", "sig", "secret-x");

                assertThat(valid).isTrue();
            }
        }

        @Test
        void nullSecret_fallsBackToConfiguredSecret() {
            try (MockedStatic<Webhook> webhookStatic = mockStatic(Webhook.class)) {
                webhookStatic.when(() -> Webhook.constructEvent(anyString(), anyString(), eq("whsec_xxx")))
                        .thenReturn(null);

                boolean valid = provider.verifyWebhook("payload", "sig", null);

                assertThat(valid).isTrue();
            }
        }

        @Test
        void invalidSignature_returnsFalse() {
            try (MockedStatic<Webhook> webhookStatic = mockStatic(Webhook.class)) {
                webhookStatic.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenThrow(new RuntimeException("invalid sig"));

                boolean valid = provider.verifyWebhook("p", "s", "x");

                assertThat(valid).isFalse();
            }
        }
    }
}
