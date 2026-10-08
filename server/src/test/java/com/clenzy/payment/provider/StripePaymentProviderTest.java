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
        provider = new StripePaymentProvider(new com.clenzy.payment.StripeGateway("sk_test_xxx"), org.mockito.Mockito.mock(com.clenzy.payment.ManagedStripeRefund.class));
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
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans={false,true})
    void commerceCheckoutPreservesTtcTaxAndInvoiceMetadataIncludingEmbeddedCard(boolean embedded)throws Exception {
        var gateway=mock(com.clenzy.payment.StripeGateway.class);
        var service=new StripePaymentProvider(gateway,mock(com.clenzy.payment.ManagedStripeRefund.class));
        var session=new Session();session.setId("cs_tax");session.setUrl("https://checkout.stripe.com/test");session.setClientSecret("test_secret");
        when(gateway.createSession(any(SessionCreateParams.class),eq("tax-request"))).thenReturn(session);
        var metadata=Map.of("baitly_commerce_invoice","true","baitly_tax_code","txcd_10000000","seller_account","acct_test");
        var request=new PaymentRequest(new BigDecimal("12"),"EUR","Test", "buyer@example.test",null,"https://example.test/success","https://example.test/cancel","tax-request",metadata,embedded,null,true);
        assertThat(service.createPayment(request).success()).isTrue();
        var capture=org.mockito.ArgumentCaptor.forClass(SessionCreateParams.class);org.mockito.Mockito.verify(gateway).createSession(capture.capture(),eq("tax-request"));
        var p=capture.getValue();assertThat(p.getAutomaticTax().getEnabled()).isTrue();assertThat(p.getInvoiceCreation().getEnabled()).isTrue();
        assertThat(p.getLineItems().getFirst().getPriceData().getUnitAmount()).isEqualTo(1200);
        assertThat(p.getLineItems().getFirst().getPriceData().getTaxBehavior()).isEqualTo(SessionCreateParams.LineItem.PriceData.TaxBehavior.INCLUSIVE);
        assertThat(p.getPaymentIntentData().getMetadata()).containsAllEntriesOf(metadata);
        assertThat(p.getInvoiceCreation().getInvoiceData().getMetadata()).containsAllEntriesOf(metadata);
        if(embedded)assertThat(p.getPaymentIntentData().getSetupFutureUsage()).isEqualTo(SessionCreateParams.PaymentIntentData.SetupFutureUsage.OFF_SESSION);
    }

    @Nested
    class ResumeEmbedded {
        private Session openSession() {
            Session session = new Session();
            session.setId("cs_existing");
            session.setStatus("open");
            session.setPaymentStatus("unpaid");
            session.setUiMode("embedded_page");
            session.setCurrency("eur");
            session.setAmountTotal(4500L);
            session.setClientSecret("test-existing-secret");
            return session;
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = { "embedded_page", "embedded" })
        void retrievesTheSameCheckoutWithoutCreatingOne(String uiMode) {
            Session session = openSession();
            session.setUiMode(uiMode);
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)))
                    .thenReturn(session);
                var result = provider.resumeEmbeddedPayment("cs_existing", new BigDecimal("45.00"), "EUR");
                assertThat(result.success()).isTrue();
                assertThat(result.clientSecret()).isEqualTo("test-existing-secret");
                sessions.verify(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)));
                sessions.verifyNoMoreInteractions();
            }
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = { "expired", "paid", "amount", "currency", "hosted", "secret" })
        void rejectsAnUnusableOrMismatchedSession(String reason) {
            Session session = openSession();
            switch (reason) {
                case "expired" -> session.setStatus("expired");
                case "paid" -> session.setPaymentStatus("paid");
                case "amount" -> session.setAmountTotal(4600L);
                case "currency" -> session.setCurrency("sar");
                case "hosted" -> session.setUiMode("hosted");
                case "secret" -> session.setClientSecret(null);
            }
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(anyString(), any(com.stripe.net.RequestOptions.class))).thenReturn(session);
                assertThat(provider.resumeEmbeddedPayment("cs_existing", new BigDecimal("45.00"), "EUR").success()).isFalse();
            }
        }

        @Test
        void stripeFailureDoesNotExposeASecretOrCreateAPayment() {
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(anyString(), any(com.stripe.net.RequestOptions.class)))
                    .thenThrow(new ApiException("test", "request", "code", 500, null));
                assertThat(provider.resumeEmbeddedPayment("cs_existing", new BigDecimal("45.00"), "EUR").success()).isFalse();
                sessions.verify(() -> Session.retrieve(anyString(), any(com.stripe.net.RequestOptions.class)));
                sessions.verifyNoMoreInteractions();
            }
        }
    }

    @Nested
    class ResumeHosted {
        private Session openSession() {
            Session session = new Session();
            session.setId("cs_existing");
            session.setStatus("open");
            session.setPaymentStatus("unpaid");
            session.setUiMode("hosted_page");
            session.setCurrency("eur");
            session.setAmountTotal(4500L);
            session.setUrl("https://checkout.stripe.com/existing");
            return session;
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = { "hosted_page", "hosted" })
        void returnsTheCanonicalLinkWithoutCreatingAnotherCheckout(String mode) {
            var session = openSession();
            session.setUiMode(mode);
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)))
                        .thenReturn(session);
                var result = provider.resumeHostedPayment("cs_existing", new BigDecimal("45"), "EUR");
                assertThat(result.success()).isTrue();
                assertThat(result.providerTxId()).isEqualTo("cs_existing");
                assertThat(result.redirectUrl()).isEqualTo(session.getUrl());
                assertThat(result.clientSecret()).isNull();
                sessions.verify(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)));
                sessions.verifyNoMoreInteractions();
            }
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = {
                "expired", "complete", "paid", "amount", "currency", "embedded", "url", "blankUrl" })
        void refusesAnUnusableSessionWithoutRecreatingIt(String reason) {
            var session = openSession();
            switch (reason) {
                case "expired" -> session.setStatus("expired");
                case "complete" -> session.setStatus("complete");
                case "paid" -> session.setPaymentStatus("paid");
                case "amount" -> session.setAmountTotal(4600L);
                case "currency" -> session.setCurrency("sar");
                case "embedded" -> session.setUiMode("embedded_page");
                case "url" -> session.setUrl(null);
                case "blankUrl" -> session.setUrl(" ");
            }
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)))
                        .thenReturn(session);
                var result = provider.resumeHostedPayment("cs_existing", new BigDecimal("45"), "EUR");
                assertThat(result.success()).isFalse();
                assertThat(result.redirectUrl()).isNull();
                sessions.verify(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)));
                sessions.verifyNoMoreInteractions();
            }
        }

        @Test
        void readFailureDoesNotCreateAnotherCheckout() {
            try (MockedStatic<Session> sessions = mockStatic(Session.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)))
                        .thenThrow(new ApiException("test", "request", "code", 500, null));
                assertThat(provider.resumeHostedPayment("cs_existing", new BigDecimal("45"), "EUR").success()).isFalse();
                sessions.verify(() -> Session.retrieve(eq("cs_existing"), any(com.stripe.net.RequestOptions.class)));
                sessions.verifyNoMoreInteractions();
            }
        }
    }

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
                sessionStatic.verify(() -> Session.create(any(SessionCreateParams.class),
                        org.mockito.ArgumentMatchers.argThat((com.stripe.net.RequestOptions options) -> "idem-1".equals(options.getIdempotencyKey()))));
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
                sessionStatic.verify(() -> Session.create(any(SessionCreateParams.class),
                        org.mockito.ArgumentMatchers.argThat((com.stripe.net.RequestOptions options) -> "idem-emb".equals(options.getIdempotencyKey()))));
                assertThat(result.redirectUrl()).isNull();
                assertThat(result.presentationMode())
                        .isEqualTo(com.clenzy.payment.PaymentPresentationMode.CLIENT_SECRET);
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
            when(refund.getStatus()).thenReturn("succeeded");

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
            when(refund.getStatus()).thenReturn("succeeded");

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

        @Test
        void checkoutRefundResolvesThePaymentIntentAndReusesAStableFullRefundKey() {
            Session session = new Session();
            session.setPaymentStatus("paid");
            session.setPaymentIntent("pi_collected");
            Refund refund = new Refund();
            refund.setId("re_confirmed");
            refund.setStatus("succeeded");
            var context = new com.clenzy.payment.RefundContext(2L, "cs_test_checkout", "TX-test", "EUR", new BigDecimal("35.00"));
            try (MockedStatic<Session> sessions = mockStatic(Session.class);
                 MockedStatic<Refund> refunds = mockStatic(Refund.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_test_checkout"), any(com.stripe.net.RequestOptions.class))).thenReturn(session);
                refunds.when(() -> Refund.create(any(RefundCreateParams.class), any(com.stripe.net.RequestOptions.class)))
                    .thenAnswer(inv -> {
                        RefundCreateParams params = inv.getArgument(0);
                        com.stripe.net.RequestOptions options = inv.getArgument(1);
                        assertThat(params.getPaymentIntent()).isEqualTo("pi_collected");
                        assertThat(params.getAmount()).isEqualTo(3500L);
                        assertThat(options.getIdempotencyKey()).isEqualTo("baitly-refund-full-TX-test");
                        return refund;
                    });
                assertThat(provider.refundPayment(context, new BigDecimal("35.00"), "test").success()).isTrue();
                assertThat(provider.refundPayment(context, new BigDecimal("35.00"), "test").success()).isTrue();
            }
        }

        @Test
        void unpaidCheckoutNeverCreatesARefund() {
            Session session = new Session();
            session.setPaymentStatus("unpaid");
            try (MockedStatic<Session> sessions = mockStatic(Session.class);
                 MockedStatic<Refund> refunds = mockStatic(Refund.class)) {
                sessions.when(() -> Session.retrieve(eq("cs_test_unpaid"), any(com.stripe.net.RequestOptions.class))).thenReturn(session);
                assertThat(provider.refundPayment("cs_test_unpaid", null, null).success()).isFalse();
                refunds.verifyNoInteractions();
            }
        }

        @Test
        void pendingRefundIsNotReportedAsCompleted() {
            Refund refund = new Refund();
            refund.setId("re_pending");
            refund.setStatus("pending");
            try (MockedStatic<Refund> refunds = mockStatic(Refund.class)) {
                refunds.when(() -> Refund.create(any(RefundCreateParams.class), any(com.stripe.net.RequestOptions.class))).thenReturn(refund);
                refunds.when(() -> Refund.retrieve(eq("re_pending"), any(com.stripe.net.RequestOptions.class))).thenReturn(refund);
                assertThat(provider.refundPayment("pi_test", null, null).success()).isFalse();
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
