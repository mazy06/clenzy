package com.clenzy.controller;

import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.integration.direct.service.DirectBookingService;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.InscriptionService;
import com.clenzy.service.MobilePaymentService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.ShopService;
import com.clenzy.service.StripeConnectService;
import com.clenzy.service.StripeService;
import com.clenzy.service.SubscriptionService;
import com.clenzy.service.UpsellService;
import com.stripe.model.Account;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Transfer;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for StripeWebhookController.
 *
 * <p>Two flavors:</p>
 * <ul>
 *   <li>Signature validation paths (no static mocking needed)</li>
 *   <li>Event dispatch paths (using MockedStatic on Webhook.constructEvent)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class StripeWebhookControllerTest {

    @Mock private StripeService stripeService;
    @Mock private InscriptionService inscriptionService;
    @Mock private SubscriptionService subscriptionService;
    @Mock private MobilePaymentService mobilePaymentService;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private StripeConnectService stripeConnectService;
    @Mock private ShopService shopService;
    @Mock private PublicBookingService publicBookingService;
    @Mock private UpsellService upsellService;
    @Mock private StripeGateway stripeGateway;
    @Mock private DirectBookingService directBookingService;
    @Mock private com.clenzy.service.ai.AiCreditGrantService aiCreditGrantService;
    @Mock private com.clenzy.service.automation.PaymentFailedTriggerService paymentFailedTriggerService;
    @Mock private com.clenzy.service.dashboard.PaymentEventActionRecorder paymentEventActionRecorder;

    @Mock private com.clenzy.service.paymentconnect.PaymentConnectionStore paymentConnectionStore;
    @Mock private com.clenzy.payment.payout.StripeBankPayoutHandler bankPayoutHandler;
    @Mock private com.clenzy.service.StripeWebhookTenantScope paymentTenantScope;
    @Mock private com.clenzy.service.InterventionBatchCheckoutService batchCheckout;
    @Mock private com.clenzy.service.InvoiceCheckoutService invoiceCheckout;
    @org.mockito.Mock private com.clenzy.service.ManagedRefundReconciliation refunds;
    private StripeWebhookController controller;

    @BeforeEach
    void setUp() throws Exception {
        controller = new StripeWebhookController(stripeService, inscriptionService, subscriptionService, mobilePaymentService, orchestrationService, stripeConnectService, shopService, publicBookingService, upsellService, stripeGateway, directBookingService, aiCreditGrantService, paymentFailedTriggerService, paymentEventActionRecorder, paymentConnectionStore, bankPayoutHandler, paymentTenantScope, batchCheckout, invoiceCheckout, refunds, mock(com.clenzy.service.BaitlyInterventionCheckoutExpiry.class));
        org.mockito.Mockito.lenient().doAnswer(invocation -> { ((Runnable) invocation.getArgument(1)).run(); return null; })
                .when(paymentTenantScope).forIntervention(anyString(), any());
        org.mockito.Mockito.lenient().doAnswer(invocation -> { ((Runnable) invocation.getArgument(1)).run(); return null; })
                .when(paymentTenantScope).forReservation(anyString(), any());
        org.mockito.Mockito.lenient().doAnswer(invocation -> { ((Runnable) invocation.getArgument(1)).run(); return null; })
                .when(paymentTenantScope).forServiceRequest(anyString(), any());
        org.mockito.Mockito.lenient().doAnswer(invocation -> { ((Runnable) invocation.getArgument(2)).run(); return null; })
                .when(paymentTenantScope).forGroupedInterventions(anyString(), org.mockito.ArgumentMatchers.nullable(String.class), any());
        setField("webhookSecret", "whsec_test_secret");
    }

    private void setField(String name, String value) throws Exception {
        Field field = StripeWebhookController.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(controller, value);
    }

    /** Build a fake Event with a stubbed deserializer + object. */
    private Event mockEvent(String type, Object stripeObject) {
        Event event = mock(Event.class, org.mockito.Mockito.withSettings().strictness(org.mockito.quality.Strictness.LENIENT));
        when(event.getType()).thenReturn(type);
        when(event.getId()).thenReturn("evt_test_1");
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);
        when(deserializer.getObject()).thenReturn(Optional.of((com.stripe.model.StripeObject) stripeObject));
        return event;
    }

    private Session mockSession(String id, String paymentStatus, String mode, Map<String, String> metadata) {
        Session s = mock(Session.class, org.mockito.Mockito.withSettings().strictness(org.mockito.quality.Strictness.LENIENT));
        when(s.getId()).thenReturn(id);
        when(s.getPaymentStatus()).thenReturn(paymentStatus);
        when(s.getMode()).thenReturn(mode);
        when(s.getMetadata()).thenReturn(metadata);
        return s;
    }


    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired"})
    void batchEventsUseCanonicalHandlerWithoutLegacySingularLookup(String type) throws Exception {
        String payload="{\"id\":\"evt_batch\",\"object\":\"event\",\"api_version\":\"" + com.stripe.Stripe.API_VERSION
            + "\",\"type\":\"" + type + "\",\"data\":{\"object\":{\"id\":\"cs_batch\",\"object\":\"checkout.session\",\"mode\":\"payment\",\"payment_status\":\"paid\"}}}";
        when(batchCheckout.handleWebhook(any(Session.class))).thenReturn(true);
        assertThat(controller.handleStripeWebhook(payload,signature(payload)).getStatusCode().value()).isEqualTo(200);
        org.mockito.Mockito.verifyNoInteractions(stripeService,paymentTenantScope,orchestrationService,paymentEventActionRecorder);
    }

    @Test void batchFailureReturns500ForRedelivery() throws Exception {
        String payload="{\"id\":\"evt_batch\",\"object\":\"event\",\"api_version\":\"" + com.stripe.Stripe.API_VERSION
            + "\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"id\":\"cs_batch\",\"object\":\"checkout.session\",\"mode\":\"payment\",\"payment_status\":\"paid\"}}}";
        when(batchCheckout.handleWebhook(any(Session.class))).thenThrow(new IllegalStateException("Ledger unavailable"));
        assertThat(controller.handleStripeWebhook(payload,signature(payload)).getStatusCode().value()).isEqualTo(500);
        org.mockito.Mockito.verifyNoInteractions(stripeService,orchestrationService);
    }

    // ─── Signature validation paths ───────────────────────────────────────────

    private String refundPayload(String type, String account) {
        return "{\"id\":\"evt_refund\",\"object\":\"event\",\"api_version\":\"" + com.stripe.Stripe.API_VERSION
            + "\",\"type\":\"" + type + "\"," + (account == null ? "" : "\"account\":\"" + account + "\",")
            + "\"data\":{\"object\":{\"id\":\"re_test\",\"object\":\"refund\",\"status\":\"succeeded\"}}}";
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"refund.created", "refund.updated", "refund.failed"})
    void signedRefundEventsTriggerCanonicalReconciliation(String type) throws Exception {
        String payload = refundPayload(type, null);
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(200);
        verify(refunds).onWebhook(org.mockito.ArgumentMatchers.argThat(refund -> "re_test".equals(refund.getId())));
        org.mockito.Mockito.verifyNoInteractions(stripeService, orchestrationService);
    }

    @Test void refundReconciliationFailureRequestsWebhookRedelivery() throws Exception {
        String payload = refundPayload("refund.updated", null);
        doThrow(new IllegalStateException("journal unavailable")).when(refunds).onWebhook(any());
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(500);
    }

    @Test void connectedAccountRefundCannotConfirmPlatformPayment() throws Exception {
        String payload = refundPayload("refund.updated", "acct_other");
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(200);
        org.mockito.Mockito.verifyNoInteractions(refunds);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired"})
    void invoiceEventsUseCanonicalHandlerWithoutLegacyConfirmation(String type) throws Exception {
        String payload="{\"id\":\"evt_invoice\",\"object\":\"event\",\"api_version\":\"" + com.stripe.Stripe.API_VERSION
            + "\",\"type\":\"" + type + "\",\"data\":{\"object\":{\"id\":\"cs_invoice\",\"object\":\"checkout.session\",\"mode\":\"payment\",\"payment_status\":\"paid\"}}}";
        when(invoiceCheckout.handleWebhook(any(Session.class))).thenReturn(true);
        assertThat(controller.handleStripeWebhook(payload,signature(payload)).getStatusCode().value()).isEqualTo(200);
        org.mockito.Mockito.verifyNoInteractions(batchCheckout, stripeService, orchestrationService);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "checkout.session.completed", "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed", "checkout.session.expired",
            "payment_intent.succeeded", "payment_intent.payment_failed", "account.updated",
            "transfer.failed", "refund.created", "refund.updated", "refund.failed", "charge.dispute.created", "charge.dispute.updated",
            "charge.dispute.closed", "charge.dispute.funds_withdrawn", "charge.dispute.funds_reinstated", "invoice.paid"})
    void incompatibleSignedSnapshotsAreRetriedInsteadOfAcknowledged(String type) throws Exception {
        String payload = "{\"id\":\"evt_old\",\"object\":\"event\",\"api_version\":\"2023-10-16\","
                + "\"type\":\"" + type + "\",\"data\":{\"object\":{\"id\":\"acct_test\",\"object\":\"account\"}}}";
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(503);
        org.mockito.Mockito.verifyNoInteractions(stripeService, stripeConnectService,
                paymentConnectionStore, bankPayoutHandler, aiCreditGrantService);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"charge.dispute.created","charge.dispute.updated","charge.dispute.closed","charge.dispute.funds_withdrawn","charge.dispute.funds_reinstated"})
    void connectedAccountDisputeCannotMutatePlatformPayments(String type) throws Exception {
        var dispute=new com.stripe.model.Dispute(); dispute.setId("dp_test");
        var event=mockEvent(type,dispute); when(event.getAccount()).thenReturn("acct_other");
        try(var webhook=mockStatic(Webhook.class)) {
            webhook.when(()->Webhook.constructEvent(anyString(),anyString(),anyString())).thenReturn(event);
            assertThat(controller.handleStripeWebhook("payload","signature").getStatusCode().value()).isEqualTo(200);
            org.mockito.Mockito.verifyNoInteractions(paymentEventActionRecorder);
        }
    }

    @Test
    void currentSignedAccountSnapshotUpdatesTheBeneficiary() throws Exception {
        String payload = "{\"id\":\"evt_current\",\"object\":\"event\",\"api_version\":\""
                + com.stripe.Stripe.API_VERSION + "\",\"type\":\"account.updated\","
                + "\"data\":{\"object\":{\"id\":\"acct_test\",\"object\":\"account\","
                + "\"charges_enabled\":true,\"payouts_enabled\":true}}}";
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(200);
        verify(stripeConnectService).handleAccountUpdated("acct_test", true, true);
    }

    @Test
    void currentSignedInvoiceReadsSubscriptionFromParent() throws Exception {
        String payload = "{\"id\":\"evt_invoice\",\"object\":\"event\",\"api_version\":\""
                + com.stripe.Stripe.API_VERSION + "\",\"type\":\"invoice.paid\","
                + "\"data\":{\"object\":{\"id\":\"in_test\",\"object\":\"invoice\","
                + "\"parent\":{\"type\":\"subscription_details\",\"subscription_details\":{\"subscription\":\"sub_test\"}}}}}";
        assertThat(controller.handleStripeWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(200);
        verify(aiCreditGrantService).grantForPaidInvoice("sub_test", "in_test");
    }

    private static String signature(String payload) throws Exception {
        long timestamp = java.time.Instant.now().getEpochSecond();
        var mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec("whsec_test_secret".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        return "t=" + timestamp + ",v1=" + java.util.HexFormat.of().formatHex(
                mac.doFinal((timestamp + "." + payload).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"payout.created","payout.updated","payout.paid","payout.failed","payout.canceled","payout.reconciliation_completed"})
    void bankPayoutEventsAreDispatchedOnlyAfterSignatureVerification(String type) throws Exception {
        var event=new Event();event.setType(type);
        try(MockedStatic<Webhook> webhook=mockStatic(Webhook.class)) {
            webhook.when(() -> Webhook.constructEvent(anyString(),anyString(),anyString())).thenReturn(event);
            assertThat(controller.handleStripeWebhook("payload","signature").getStatusCode().value()).isEqualTo(200);
            verify(bankPayoutHandler).handleVerifiedEvent(event);
        }
    }

    @Test void failedBankReconciliationReturns500ForStripeRedelivery() throws Exception {
        var event=new Event();event.setType("payout.paid");
        doThrow(new IllegalStateException("Database unavailable")).when(bankPayoutHandler).handleVerifiedEvent(event);
        try(MockedStatic<Webhook> webhook=mockStatic(Webhook.class)) {
            webhook.when(() -> Webhook.constructEvent(anyString(),anyString(),anyString())).thenReturn(event);
            assertThat(controller.handleStripeWebhook("payload","signature").getStatusCode().value()).isEqualTo(500);
        }
    }

    @Test void invalidBankSignatureNeverReachesThePrivilegedHandler() {
        assertThat(controller.handleStripeWebhook("{\"type\":\"payout.paid\"}","invalid").getStatusCode().value()).isEqualTo(400);
        org.mockito.Mockito.verifyNoInteractions(bankPayoutHandler);
    }

    @Nested
    @DisplayName("handleStripeWebhook - signature verification")
    class HandleWebhookSignatureVerification {

        @Test
        @DisplayName("returns 400 when signature is invalid")
        void whenInvalidSignature_thenReturnsBadRequest() {
            ResponseEntity<String> response = controller.handleStripeWebhook(
                    "{\"type\": \"checkout.session.completed\"}", "invalid-sig");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when payload is empty")
        void whenEmptyPayload_thenReturnsBadRequest() {
            ResponseEntity<String> response = controller.handleStripeWebhook("", "");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when payload is null-like JSON")
        void whenMalformedPayload_thenReturnsBadRequest() {
            ResponseEntity<String> response = controller.handleStripeWebhook("not-json", "t=123,v1=abc");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    // ─── Construction smoke test ──────────────────────────────────────────────

    @Nested
    @DisplayName("controller construction")
    class Construction {

        @Test
        @DisplayName("controller is correctly instantiated")
        void whenConstructed_thenNotNull() {
            assertThat(controller).isNotNull();
        }
    }

    // ─── Dispatch tests with MockedStatic ─────────────────────────────────────

    @Nested
    @DisplayName("checkout.session.completed dispatch")
    class CheckoutCompleted {

        @Test
        @DisplayName("dispatches to inscriptionService.confirmPayment when type='inscription'")
        void whenTypeInscription_thenCallsInscriptionService() {
            Session s = mockSession("sess_1", "paid", "subscription",
                    Map.of("type", "inscription"));
            when(s.getCustomer()).thenReturn("cus_1");
            when(s.getSubscription()).thenReturn("sub_1");
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(inscriptionService).confirmPayment("sess_1", "cus_1", "sub_1");
            }
        }

        @Test
        @DisplayName("dispatches to stripeService.confirmPayment for intervention payment (no type metadata)")
        void whenNoType_thenCallsStripeConfirmPayment() {
            Session s = mockSession("sess_2", "paid", "payment", new HashMap<>());
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmPayment("sess_2");
            }
        }

        @Test
        @DisplayName("dispatches to shopService.completeOrder when type='hardware_purchase'")
        void whenTypeHardware_thenCallsShop() {
            Session s = mockSession("sess_h", "paid", "payment",
                    Map.of("type", "hardware_purchase"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(shopService).completeOrder("sess_h");
            }
        }

        @Test
        @DisplayName("dispatches to subscriptionService.completeUpgrade when type='upgrade'")
        void whenTypeUpgrade_thenCallsSubscription() {
            Session s = mockSession("sess_u", "paid", "subscription",
                    Map.of("type", "upgrade"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(subscriptionService).completeUpgrade("sess_u");
            }
        }

        @Test
        @DisplayName("dispatches to confirmGroupedPayment when type='grouped_deferred'")
        void whenTypeGroupedDeferred_thenCallsGrouped() {
            Session s = mockSession("sess_g", "paid", "payment",
                    Map.of("type", "grouped_deferred", "intervention_ids", "1,2,3"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmGroupedPayment("sess_g", "1,2,3");
            }
        }

        @Test
        @DisplayName("dispatches to confirmReservationPayment when type='reservation'")
        void whenTypeReservation_thenCallsReservation() {
            Session s = mockSession("sess_r", "paid", "payment",
                    Map.of("type", "reservation"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmReservationPayment("sess_r");
            }
        }

        @Test
        @DisplayName("dispatches to publicBookingService when type='booking_engine'")
        void whenTypeBookingEngine_thenCallsBookingEngine() {
            Session s = mockSession("sess_be", "paid", "payment",
                    Map.of("type", "booking_engine"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(publicBookingService).confirmBookingEngineCheckout(s);
            }
        }

        @Test
        @DisplayName("dispatches to confirmServiceRequestPayment when type='service_request'")
        void whenTypeServiceRequest_thenCallsConfirm() {
            Session s = mockSession("sess_sr", "paid", "payment",
                    Map.of("type", "service_request", "service_request_id", "42"));
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmServiceRequestPayment("sess_sr");
            }
        }

        @Test
        @DisplayName("skips processing when paymentStatus is not 'paid' or 'no_payment_required'")
        void whenUnpaid_thenSkipsProcessing() {
            Session s = mockSession("sess_x", "unpaid", "payment", new HashMap<>());
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService, never()).confirmPayment(any());
            }
        }

        @Test
        @DisplayName("accepts 'no_payment_required' as paid status")
        void whenNoPaymentRequired_thenProcessed() {
            Session s = mockSession("sess_free", "no_payment_required", "subscription",
                    Map.of("type", "inscription"));
            when(s.getCustomer()).thenReturn("cus_free");
            when(s.getSubscription()).thenReturn("sub_free");
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(inscriptionService).confirmPayment("sess_free", "cus_free", "sub_free");
            }
        }

        @Test
        @DisplayName("calls orchestrationService.completeTransaction when metadata has transactionRef")
        void whenTransactionRef_thenCompleteOrchestrator() {
            Map<String, String> meta = new HashMap<>();
            meta.put("transactionRef", "TX-123");
            Session s = mockSession("sess_t", "paid", "payment", meta);
            Event event = mockEvent("checkout.session.completed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(orchestrationService).completeTransaction("TX-123");
            }
        }

        @Test
        @DisplayName("returns 500 when intervention confirmation throws (Z3-BUGS-10: Stripe re-delivers)")
        void whenConfirmationFails_thenReturns500() {
            Session s = mockSession("sess_e", "paid", "payment", new HashMap<>());
            Event event = mockEvent("checkout.session.completed", s);
            doThrow(new RuntimeException("boom")).when(stripeService).confirmPayment("sess_e");

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }

        @Test
        @DisplayName("returns 500 when reservation confirmation throws so Stripe re-delivers (Z3-BUGS-10)")
        void whenReservationConfirmationFails_thenReturns500() {
            Session s = mockSession("sess_r_fail", "paid", "payment",
                    Map.of("type", "reservation"));
            Event event = mockEvent("checkout.session.completed", s);
            doThrow(new RuntimeException("stripeSessionId pas encore persiste"))
                    .when(stripeService).confirmReservationPayment("sess_r_fail");

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }

        @Test
        @DisplayName("returns 500 when booking engine confirmation throws (Z3-BUGS-10)")
        void whenBookingEngineConfirmationFails_thenReturns500() {
            Session s = mockSession("sess_be_fail", "paid", "payment",
                    Map.of("type", "booking_engine"));
            Event event = mockEvent("checkout.session.completed", s);
            doThrow(new RuntimeException("conflit calendrier")).when(publicBookingService)
                    .confirmBookingEngineCheckout(s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }

        @Test
        @DisplayName("returns 500 when upsell confirmation throws (Z3-BUGS-10)")
        void whenUpsellConfirmationFails_thenReturns500() {
            Session s = mockSession("sess_up_fail", "paid", "payment",
                    Map.of("type", "upsell"));
            Event event = mockEvent("checkout.session.completed", s);
            doThrow(new RuntimeException("upsell introuvable")).when(upsellService)
                    .markPaidBySession("sess_up_fail");

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }

        @Test
        @DisplayName("returns 500 when service request confirmation throws (Z3-BUGS-10)")
        void whenServiceRequestConfirmationFails_thenReturns500() {
            Session s = mockSession("sess_sr_fail", "paid", "payment",
                    Map.of("type", "service_request", "service_request_id", "42"));
            Event event = mockEvent("checkout.session.completed", s);
            doThrow(new RuntimeException("SR deadlock")).when(stripeService)
                    .confirmServiceRequestPayment("sess_sr_fail");

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }
    }

    @Nested
    @DisplayName("checkout.session.async_payment_succeeded dispatch")
    class AsyncPaymentSucceeded {

        @Test
        @DisplayName("dispatches to confirmReservationPayment when type='reservation'")
        void whenTypeReservation_thenCallsReservation() {
            Session s = mockSession("sess_r_async", "paid", "payment",
                    Map.of("type", "reservation"));
            Event event = mockEvent("checkout.session.async_payment_succeeded", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmReservationPayment("sess_r_async");
            }
        }

        @Test
        @DisplayName("dispatches to confirmPayment when type is empty")
        void whenNoType_thenFallbackIntervention() {
            Session s = mockSession("sess_fb", "paid", "payment", new HashMap<>());
            Event event = mockEvent("checkout.session.async_payment_succeeded", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmPayment("sess_fb");
            }
        }

        @Test
        @DisplayName("dispatches to shopService when type='hardware_purchase'")
        void whenTypeHardware_thenCallsShop() {
            Session s = mockSession("sess_h_async", "paid", "payment",
                    Map.of("type", "hardware_purchase"));
            Event event = mockEvent("checkout.session.async_payment_succeeded", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(shopService).completeOrder("sess_h_async");
            }
        }

        @Test
        @DisplayName("dispatches to confirmGroupedPayment when type='grouped_deferred'")
        void whenTypeGrouped_thenCallsGrouped() {
            Session s = mockSession("sess_g_async", "paid", "payment",
                    Map.of("type", "grouped_deferred", "intervention_ids", "9"));
            Event event = mockEvent("checkout.session.async_payment_succeeded", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).confirmGroupedPayment("sess_g_async", "9");
            }
        }
    }

    @Nested
    @DisplayName("checkout.session.async_payment_failed dispatch")
    class AsyncPaymentFailed {

        @Test
        @DisplayName("dispatches to markReservationPaymentFailed when type='reservation'")
        void whenTypeReservation_thenCallsFail() {
            Session s = mockSession("sess_rf", "unpaid", "payment",
                    Map.of("type", "reservation"));
            Event event = mockEvent("checkout.session.async_payment_failed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).markReservationPaymentFailed("sess_rf");
            }
        }

        @Test
        @DisplayName("dispatches to markServiceRequestPaymentFailed when type='service_request'")
        void whenTypeServiceRequest_thenCallsFail() {
            Session s = mockSession("sess_srf", "unpaid", "payment",
                    Map.of("type", "service_request"));
            Event event = mockEvent("checkout.session.async_payment_failed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).markServiceRequestPaymentFailed("sess_srf");
            }
        }

        @Test
        @DisplayName("dispatches to markGroupedPaymentAsFailed when type='grouped_deferred'")
        void whenTypeGrouped_thenCallsFail() {
            Session s = mockSession("sess_gf", "unpaid", "payment",
                    Map.of("type", "grouped_deferred", "intervention_ids", "5,6"));
            Event event = mockEvent("checkout.session.async_payment_failed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).markGroupedPaymentAsFailed("sess_gf", "5,6");
            }
        }

        @Test
        @DisplayName("dispatches to inscriptionService.markInscriptionFailed when type='inscription'")
        void whenTypeInscription_thenCallsFail() {
            Session s = mockSession("sess_if", "unpaid", "subscription",
                    Map.of("type", "inscription"));
            Event event = mockEvent("checkout.session.async_payment_failed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(inscriptionService).markInscriptionFailed("sess_if");
            }
        }

        @Test
        @DisplayName("dispatches to markPaymentAsFailed when no type")
        void whenNoType_thenCallsMarkFailed() {
            Session s = mockSession("sess_nf", "unpaid", "payment", new HashMap<>());
            Event event = mockEvent("checkout.session.async_payment_failed", s);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).markPaymentAsFailed("sess_nf");
            }
        }
    }

    @Nested
    @DisplayName("payment_intent.succeeded dispatch")
    class PaymentIntentSucceeded {

        @Test
        @DisplayName("dispatches to mobilePaymentService.completeSubscriptionUpgrade when type='mobile_upgrade'")
        void whenTypeMobileUpgrade_thenCallsMobile() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_1");
            when(pi.getMetadata()).thenReturn(Map.of("type", "mobile_upgrade"));
            Event event = mockEvent("payment_intent.succeeded", pi);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(mobilePaymentService).completeSubscriptionUpgrade(pi);
            }
        }

        @Test
        @DisplayName("dispatches to mobilePaymentService.completeInterventionPayment when type='mobile_intervention'")
        void whenTypeMobileIntervention_thenCallsMobile() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_2");
            when(pi.getMetadata()).thenReturn(Map.of("type", "mobile_intervention"));
            Event event = mockEvent("payment_intent.succeeded", pi);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(mobilePaymentService).completeInterventionPayment(pi);
            }
        }

        @Test
        @DisplayName("ignores PaymentIntent without type metadata")
        void whenNoType_thenIgnored() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_x");
            when(pi.getMetadata()).thenReturn(new HashMap<>());
            Event event = mockEvent("payment_intent.succeeded", pi);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(mobilePaymentService, never()).completeInterventionPayment(any());
                verify(mobilePaymentService, never()).completeSubscriptionUpgrade(any());
            }
        }

        @Test
        @DisplayName("retries an unreadable PaymentIntent instead of losing the event")
        void whenNullPaymentIntent_thenReturns503() {
            Event event = mock(Event.class);
            when(event.getType()).thenReturn("payment_intent.succeeded");
            EventDataObjectDeserializer des = mock(EventDataObjectDeserializer.class);
            when(event.getDataObjectDeserializer()).thenReturn(des);
            when(des.getObject()).thenReturn(Optional.empty());

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(503);
            }
        }
    }

    @Nested
    @DisplayName("payment_intent.payment_failed dispatch")
    class PaymentIntentFailed {

        @Test
        @DisplayName("dispatches to markPaymentAsFailed when type='mobile_intervention'")
        void whenMobileIntervention_thenCallsMarkFailed() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_3");
            when(pi.getMetadata()).thenReturn(Map.of("type", "mobile_intervention", "interventionId", "5"));
            Event event = mockEvent("payment_intent.payment_failed", pi);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService).markPaymentAsFailed("pi_3");
                // F5c : le declencheur PAYMENT_FAILED du moteur est notifie
                verify(paymentFailedTriggerService).fireForFailedPaymentIntent(
                        "pi_3", Map.of("type", "mobile_intervention", "interventionId", "5"));
            }
        }

        @Test
        @DisplayName("no action when type is mobile_upgrade")
        void whenMobileUpgrade_thenNoOp() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_4");
            when(pi.getMetadata()).thenReturn(Map.of("type", "mobile_upgrade"));
            Event event = mockEvent("payment_intent.payment_failed", pi);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeService, never()).markPaymentAsFailed(any());
                // F5c : le capteur est appele meme sans action mobile (resolution org en aval)
                verify(paymentFailedTriggerService).fireForFailedPaymentIntent(
                        "pi_4", Map.of("type", "mobile_upgrade"));
            }
        }
    }

    @Nested
    @DisplayName("account.updated dispatch")
    class AccountUpdated {

        @Test
        void deauthorizationRevokesTheStoredConnection() {
            Event event = new Event();
            event.setId("evt_deauthorized"); event.setType("account.application.deauthorized"); event.setAccount("acct_revoked");
            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString())).thenReturn(event);
                assertThat(controller.handleStripeWebhook("payload", "sig").getStatusCode().value()).isEqualTo(200);
                verify(stripeConnectService).handleAccountUpdated("acct_revoked", false, false);
                verify(paymentConnectionStore).deauthorize("acct_revoked");
            }
        }

        @Test
        @DisplayName("dispatches to stripeConnectService.handleAccountUpdated")
        void whenAccountUpdated_thenCallsStripeConnect() {
            Account account = mock(Account.class);
            when(account.getId()).thenReturn("acct_1");
            when(account.getChargesEnabled()).thenReturn(true);
            when(account.getPayoutsEnabled()).thenReturn(true);
            Event event = mockEvent("account.updated", account);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeConnectService).handleAccountUpdated("acct_1", true, true);
            }
        }

        @Test
        @DisplayName("handles null chargesEnabled/payoutsEnabled as false")
        void whenNullStatuses_thenFalse() {
            Account account = mock(Account.class);
            when(account.getId()).thenReturn("acct_2");
            when(account.getChargesEnabled()).thenReturn(null);
            when(account.getPayoutsEnabled()).thenReturn(null);
            Event event = mockEvent("account.updated", account);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                verify(stripeConnectService).handleAccountUpdated("acct_2", false, false);
            }
        }

        @Test
        @DisplayName("returns 500 when stripeConnectService throws (Z3-BUGS-10: Stripe re-delivers)")
        void whenServiceThrows_thenReturns500() {
            Account account = mock(Account.class);
            when(account.getId()).thenReturn("acct_e");
            when(account.getChargesEnabled()).thenReturn(true);
            when(account.getPayoutsEnabled()).thenReturn(false);
            Event event = mockEvent("account.updated", account);
            doThrow(new RuntimeException("err")).when(stripeConnectService)
                    .handleAccountUpdated(anyString(), anyBoolean(), anyBoolean());

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }
    }

    @Nested
    @DisplayName("transfer.failed dispatch")
    class TransferFailed {

        @Test
        @DisplayName("logs but returns 200")
        void whenTransferFailed_thenReturns200() {
            Transfer transfer = mock(Transfer.class);
            when(transfer.getId()).thenReturn("tr_1");
            when(transfer.getDestination()).thenReturn("acct_dest");
            when(transfer.getAmount()).thenReturn(5000L);
            Event event = mockEvent("transfer.failed", transfer);

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
            }
        }
    }

    @Nested
    @DisplayName("unhandled event types")
    class UnhandledEvents {

        @Test
        @DisplayName("returns 200 for unknown events without action")
        void whenUnknownEvent_thenReturns200() {
            Event event = mock(Event.class);
            when(event.getType()).thenReturn("customer.subscription.updated");

            try (MockedStatic<Webhook> mockedWebhook = mockStatic(Webhook.class)) {
                mockedWebhook.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                        .thenReturn(event);

                ResponseEntity<String> response = controller.handleStripeWebhook("payload", "sig");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
            }
        }
    }

    private static boolean anyBoolean() {
        return org.mockito.ArgumentMatchers.anyBoolean();
    }
}
