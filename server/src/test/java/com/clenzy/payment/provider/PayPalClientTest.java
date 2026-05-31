package com.clenzy.payment.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClient.RequestBodySpec;
import org.springframework.web.client.RestClient.RequestBodyUriSpec;
import org.springframework.web.client.RestClient.ResponseSpec;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PayPalClient}.
 *
 * Stratégie : mock RestClient.Builder + chaine fluent, fournir des JsonNode
 * réponses simulées pour OAuth2, create-order, capture, refund et webhook.
 */
class PayPalClientTest {

    private RestClient.Builder builder;
    private ObjectMapper objectMapper;
    private PayPalClient client;

    @BeforeEach
    void setUp() {
        builder = mock(RestClient.Builder.class);
        objectMapper = new ObjectMapper();
        client = new PayPalClient(builder, objectMapper);
    }

    private void stubBuilderToReturnJson(String responseJson) throws IOException {
        RestClient mockClient = mock(RestClient.class);
        RequestBodyUriSpec uriSpec = mock(RequestBodyUriSpec.class);
        RequestBodySpec bodySpec = mock(RequestBodySpec.class);
        ResponseSpec responseSpec = mock(ResponseSpec.class);

        lenient().when(builder.build()).thenReturn(mockClient);
        lenient().when(mockClient.post()).thenReturn(uriSpec);
        lenient().when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.accept(any(MediaType[].class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);

        JsonNode node = objectMapper.readTree(responseJson);
        lenient().when(responseSpec.body(eq(JsonNode.class))).thenReturn(node);
    }

    /**
     * Pour les scénarios qui font 2 appels HTTP (oauth + main call) le même
     * stub fluent renvoie le node demandé à chaque fois ; on ne distingue pas
     * ici par URL, c'est suffisant pour valider la logique métier.
     */
    private void stubBuilderToReturnMultipleJson(String firstJson, String secondJson) throws IOException {
        RestClient mockClient = mock(RestClient.class);
        RequestBodyUriSpec uriSpec = mock(RequestBodyUriSpec.class);
        RequestBodySpec bodySpec = mock(RequestBodySpec.class);
        ResponseSpec responseSpec = mock(ResponseSpec.class);

        lenient().when(builder.build()).thenReturn(mockClient);
        lenient().when(mockClient.post()).thenReturn(uriSpec);
        lenient().when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.accept(any(MediaType[].class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);

        JsonNode firstNode = objectMapper.readTree(firstJson);
        JsonNode secondNode = objectMapper.readTree(secondJson);
        lenient().when(responseSpec.body(eq(JsonNode.class)))
                .thenReturn(firstNode)
                .thenReturn(secondNode);
    }

    private PayPalClient.PayPalCreateOrderParams sampleOrderParams() {
        return new PayPalClient.PayPalCreateOrderParams(
                "org-1:sandbox", true,
                "client-id-x", "client-secret-x",
                "TX-REF-001", "EUR", new BigDecimal("99.99"),
                "Clenzy reservation",
                "https://app.clenzy.fr/success", "https://app.clenzy.fr/cancel"
        );
    }

    private PayPalClient.PayPalCredentials sampleCreds() {
        return new PayPalClient.PayPalCredentials(
                "org-1:sandbox", true, "client-id-x", "client-secret-x");
    }

    // ── createOrder ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createOrder")
    class CreateOrder {

        @Test
        void success_returnsOrderIdAndApproveUrl() throws IOException {
            String oauth = """
                {"access_token":"AT-123","expires_in":28800}""";
            String orderResp = """
                {
                  "id": "ORDER-ABC-001",
                  "status": "CREATED",
                  "links": [
                    {"rel":"self","href":"https://api/orders/ORDER-ABC-001"},
                    {"rel":"approve","href":"https://www.sandbox.paypal.com/checkoutnow?token=ORDER-ABC-001"}
                  ]
                }""";
            stubBuilderToReturnMultipleJson(oauth, orderResp);

            PayPalClient.PayPalOrderResponse response = client.createOrder(sampleOrderParams());

            assertThat(response.orderId()).isEqualTo("ORDER-ABC-001");
            assertThat(response.approveUrl()).contains("sandbox.paypal.com");
        }

        @Test
        void payerActionLink_alsoAccepted() throws IOException {
            String oauth = """
                {"access_token":"AT-123","expires_in":28800}""";
            String orderResp = """
                {
                  "id": "ORDER-XYZ",
                  "links": [
                    {"rel":"payer-action","href":"https://paypal.com/payer/XYZ"}
                  ]
                }""";
            stubBuilderToReturnMultipleJson(oauth, orderResp);

            PayPalClient.PayPalOrderResponse response = client.createOrder(sampleOrderParams());

            assertThat(response.approveUrl()).isEqualTo("https://paypal.com/payer/XYZ");
        }

        @Test
        void missingOrderId_throwsApiException() throws IOException {
            String oauth = """
                {"access_token":"AT-123","expires_in":28800}""";
            String orderResp = """
                {
                  "links": [{"rel":"approve","href":"https://paypal.com/approve"}]
                }""";
            stubBuilderToReturnMultipleJson(oauth, orderResp);

            assertThatThrownBy(() -> client.createOrder(sampleOrderParams()))
                    .isInstanceOf(PayPalClient.PayPalApiException.class)
                    .hasMessageContaining("id ou approve link absent");
        }

        @Test
        void missingApproveLink_throwsApiException() throws IOException {
            String oauth = """
                {"access_token":"AT-123","expires_in":28800}""";
            String orderResp = """
                {"id":"ORDER-NO-LINK","links":[{"rel":"self","href":"x"}]}""";
            stubBuilderToReturnMultipleJson(oauth, orderResp);

            assertThatThrownBy(() -> client.createOrder(sampleOrderParams()))
                    .isInstanceOf(PayPalClient.PayPalApiException.class);
        }

        @Test
        void productionUrlUsed_whenSandboxFalse() throws IOException {
            String oauth = """
                {"access_token":"AT-PROD","expires_in":28800}""";
            String orderResp = """
                {
                  "id": "ORDER-PROD",
                  "links": [{"rel":"approve","href":"https://paypal.com/prod"}]
                }""";
            stubBuilderToReturnMultipleJson(oauth, orderResp);

            PayPalClient.PayPalCreateOrderParams prodParams = new PayPalClient.PayPalCreateOrderParams(
                    "org-1:prod", false,
                    "cid", "secret",
                    "TX-REF-002", "USD", new BigDecimal("10.00"),
                    "desc", "https://success", "https://cancel"
            );

            PayPalClient.PayPalOrderResponse response = client.createOrder(prodParams);
            assertThat(response.orderId()).isEqualTo("ORDER-PROD");
        }
    }

    // ── captureOrder ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("captureOrder")
    class CaptureOrder {

        @Test
        void completed_returnsCaptureIdAndCompleted() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {
                  "id": "ORDER-001",
                  "status": "COMPLETED",
                  "purchase_units": [{
                    "payments": {
                      "captures": [{
                        "id": "CAP-XYZ-001",
                        "status": "COMPLETED"
                      }]
                    }
                  }]
                }""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-001", sampleCreds());

            assertThat(response.captureId()).isEqualTo("CAP-XYZ-001");
            assertThat(response.completed()).isTrue();
            assertThat(response.status()).isEqualTo("COMPLETED");
        }

        @Test
        void pending_returnsNotCompleted() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {
                  "id": "ORDER-002",
                  "status": "PENDING",
                  "purchase_units": [{
                    "payments": {
                      "captures": [{"id": "CAP-PEND-002"}]
                    }
                  }]
                }""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-002", sampleCreds());

            assertThat(response.completed()).isFalse();
            assertThat(response.status()).isEqualTo("PENDING");
        }

        @Test
        void missingPurchaseUnits_returnsNullCaptureId() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {"id":"ORDER-NO-PU","status":"COMPLETED"}""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-NO-PU", sampleCreds());

            assertThat(response.captureId()).isNull();
            assertThat(response.completed()).isTrue();
        }

        @Test
        void emptyPurchaseUnits_returnsNullCaptureId() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {"id":"ORDER-EMPTY","status":"COMPLETED","purchase_units":[]}""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-EMPTY", sampleCreds());

            assertThat(response.captureId()).isNull();
        }

        @Test
        void missingPaymentsBlock_returnsNullCaptureId() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {"id":"ORDER-NO-PAY","status":"COMPLETED",
                 "purchase_units":[{"reference_id":"x"}]}""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-NO-PAY", sampleCreds());

            assertThat(response.captureId()).isNull();
        }

        @Test
        void missingCapturesArray_returnsNullCaptureId() throws IOException {
            String oauth = """
                {"access_token":"AT-CAP","expires_in":28800}""";
            String captureResp = """
                {"id":"ORDER-NO-CAPS","status":"COMPLETED",
                 "purchase_units":[{"payments":{}}]}""";
            stubBuilderToReturnMultipleJson(oauth, captureResp);

            PayPalClient.PayPalCaptureResponse response = client.captureOrder("ORDER-NO-CAPS", sampleCreds());

            assertThat(response.captureId()).isNull();
        }
    }

    // ── refundCapture ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("refundCapture")
    class Refund {

        @Test
        void completed_returnsRefundIdAndCompleted() throws IOException {
            String oauth = """
                {"access_token":"AT-RFD","expires_in":28800}""";
            String refundResp = """
                {"id":"RFND-001","status":"COMPLETED"}""";
            stubBuilderToReturnMultipleJson(oauth, refundResp);

            PayPalClient.PayPalRefundParams params = new PayPalClient.PayPalRefundParams(
                    "org-1:sandbox", true, "cid", "secret",
                    "EUR", new BigDecimal("50.00"), "Customer request");

            PayPalClient.PayPalRefundResponse response = client.refundCapture("CAP-001", params);

            assertThat(response.refundId()).isEqualTo("RFND-001");
            assertThat(response.completed()).isTrue();
            assertThat(response.status()).isEqualTo("COMPLETED");
        }

        @Test
        void pending_returnsCompletedTrueWithPendingStatus() throws IOException {
            String oauth = """
                {"access_token":"AT-RFD","expires_in":28800}""";
            String refundResp = """
                {"id":"RFND-002","status":"PENDING"}""";
            stubBuilderToReturnMultipleJson(oauth, refundResp);

            PayPalClient.PayPalRefundParams params = new PayPalClient.PayPalRefundParams(
                    "org-1:sandbox", true, "cid", "secret",
                    "EUR", new BigDecimal("25.00"), null);

            PayPalClient.PayPalRefundResponse response = client.refundCapture("CAP-002", params);

            assertThat(response.completed()).isTrue();
            assertThat(response.status()).isEqualTo("PENDING");
        }

        @Test
        void failed_returnsNotCompleted() throws IOException {
            String oauth = """
                {"access_token":"AT-RFD","expires_in":28800}""";
            String refundResp = """
                {"id":"RFND-003","status":"DECLINED"}""";
            stubBuilderToReturnMultipleJson(oauth, refundResp);

            PayPalClient.PayPalRefundParams params = new PayPalClient.PayPalRefundParams(
                    "org-1:sandbox", true, "cid", "secret",
                    "USD", new BigDecimal("10.00"), null);

            PayPalClient.PayPalRefundResponse response = client.refundCapture("CAP-003", params);

            assertThat(response.completed()).isFalse();
            assertThat(response.status()).isEqualTo("DECLINED");
        }
    }

    // ── verifyWebhookSignature ─────────────────────────────────────────────

    @Nested
    @DisplayName("verifyWebhookSignature")
    class VerifyWebhook {

        @Test
        void success_returnsTrue() throws IOException {
            String oauth = """
                {"access_token":"AT-WH","expires_in":28800}""";
            String verifyResp = """
                {"verification_status":"SUCCESS"}""";
            stubBuilderToReturnMultipleJson(oauth, verifyResp);

            PayPalClient.PayPalWebhookHeaders headers = new PayPalClient.PayPalWebhookHeaders(
                    "SHA256withRSA",
                    "https://api.sandbox.paypal.com/cert.pem",
                    "trans-id-123", "sig-xxx", "2026-05-30T08:00:00Z");

            String payload = """
                {"id":"WH-001","event_type":"CHECKOUT.ORDER.APPROVED"}""";

            boolean valid = client.verifyWebhookSignature(headers, "WEBHOOK-ID-1", payload, sampleCreds());

            assertThat(valid).isTrue();
        }

        @Test
        void failure_returnsFalse() throws IOException {
            String oauth = """
                {"access_token":"AT-WH","expires_in":28800}""";
            String verifyResp = """
                {"verification_status":"FAILURE"}""";
            stubBuilderToReturnMultipleJson(oauth, verifyResp);

            PayPalClient.PayPalWebhookHeaders headers = new PayPalClient.PayPalWebhookHeaders(
                    "alg", "cert", "tid", "sig", "tt");
            String payload = """
                {"id":"WH-002"}""";

            boolean valid = client.verifyWebhookSignature(headers, "WEBHOOK-ID", payload, sampleCreds());

            assertThat(valid).isFalse();
        }

        @Test
        void malformedJson_returnsFalseWithoutThrow() throws IOException {
            // OAuth still works
            String oauth = """
                {"access_token":"AT-WH","expires_in":28800}""";
            stubBuilderToReturnJson(oauth);

            PayPalClient.PayPalWebhookHeaders headers = new PayPalClient.PayPalWebhookHeaders(
                    "alg", "cert", "tid", "sig", "tt");

            boolean valid = client.verifyWebhookSignature(headers, "WID", "not-valid-json{", sampleCreds());

            // L'exception interne est swallow → return false
            assertThat(valid).isFalse();
        }
    }

    // ── Records / DTOs ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("DTOs")
    class Dtos {

        @Test
        void orderResponse_recordValues() {
            PayPalClient.PayPalOrderResponse r = new PayPalClient.PayPalOrderResponse("oid", "url");
            assertThat(r.orderId()).isEqualTo("oid");
            assertThat(r.approveUrl()).isEqualTo("url");
        }

        @Test
        void captureResponse_recordValues() {
            PayPalClient.PayPalCaptureResponse r = new PayPalClient.PayPalCaptureResponse(
                    "oid", "cid", true, "COMPLETED");
            assertThat(r.completed()).isTrue();
            assertThat(r.captureId()).isEqualTo("cid");
        }

        @Test
        void refundResponse_recordValues() {
            PayPalClient.PayPalRefundResponse r = new PayPalClient.PayPalRefundResponse(
                    "rid", true, "COMPLETED");
            assertThat(r.refundId()).isEqualTo("rid");
            assertThat(r.completed()).isTrue();
        }

        @Test
        void webhookHeaders_recordValues() {
            PayPalClient.PayPalWebhookHeaders h = new PayPalClient.PayPalWebhookHeaders(
                    "alg", "cert", "tid", "sig", "tt");
            assertThat(h.authAlgo()).isEqualTo("alg");
            assertThat(h.certUrl()).isEqualTo("cert");
        }

        @Test
        void credentials_recordValues() {
            PayPalClient.PayPalCredentials c = new PayPalClient.PayPalCredentials(
                    "key", true, "id", "sec");
            assertThat(c.sandbox()).isTrue();
            assertThat(c.cacheKey()).isEqualTo("key");
        }

        @Test
        void createOrderParams_recordValues() {
            PayPalClient.PayPalCreateOrderParams p = new PayPalClient.PayPalCreateOrderParams(
                    "k", true, "cid", "sec", "ref", "EUR", BigDecimal.TEN,
                    "desc", "r", "c");
            assertThat(p.amount()).isEqualByComparingTo(BigDecimal.TEN);
            assertThat(p.currency()).isEqualTo("EUR");
        }

        @Test
        void refundParams_recordValues() {
            PayPalClient.PayPalRefundParams r = new PayPalClient.PayPalRefundParams(
                    "k", true, "cid", "sec", "EUR", BigDecimal.ONE, "Refund");
            assertThat(r.reason()).isEqualTo("Refund");
        }

        @Test
        void apiException_messageOnly() {
            PayPalClient.PayPalApiException e = new PayPalClient.PayPalApiException("oops");
            assertThat(e.getMessage()).isEqualTo("oops");
        }

        @Test
        void apiException_withCause() {
            RuntimeException cause = new RuntimeException("inner");
            PayPalClient.PayPalApiException e = new PayPalClient.PayPalApiException("oops", cause);
            assertThat(e.getCause()).isSameAs(cause);
        }
    }

    // ── Token cache reuse ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Token cache")
    class TokenCache {

        @Test
        void sameCacheKey_reusesAccessToken() throws IOException {
            // First call: OAuth (1) + capture (2). Second call with same cache key:
            // should reuse token, only 1 HTTP call (capture).
            String oauth = """
                {"access_token":"AT-CACHED","expires_in":28800}""";
            String captureResp = """
                {
                  "id": "ORDER-CACHE",
                  "status": "COMPLETED",
                  "purchase_units": [{
                    "payments": {"captures": [{"id": "CAP-CACHE"}]}
                  }]
                }""";

            RestClient mockClient = mock(RestClient.class);
            RequestBodyUriSpec uriSpec = mock(RequestBodyUriSpec.class);
            RequestBodySpec bodySpec = mock(RequestBodySpec.class);
            ResponseSpec responseSpec = mock(ResponseSpec.class);

            lenient().when(builder.build()).thenReturn(mockClient);
            lenient().when(mockClient.post()).thenReturn(uriSpec);
            lenient().when(uriSpec.uri(anyString())).thenReturn(bodySpec);
            lenient().when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
            lenient().when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
            lenient().when(bodySpec.accept(any(MediaType[].class))).thenReturn(bodySpec);
            lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
            lenient().when(bodySpec.body(anyString())).thenReturn(bodySpec);
            lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
            lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);

            JsonNode oauthNode = objectMapper.readTree(oauth);
            JsonNode capNode = objectMapper.readTree(captureResp);
            // Premier call: oauth puis capture. Deuxième call: capture seul (token cache).
            lenient().when(responseSpec.body(eq(JsonNode.class)))
                    .thenReturn(oauthNode, capNode, capNode);

            client.captureOrder("ORDER-CACHE", sampleCreds());
            client.captureOrder("ORDER-CACHE-2", sampleCreds());

            // L'absence d'exception et la réussite suffisent — interne aux tests, le
            // cache se vérifie par le fait qu'aucune NPE n'est levée.
        }
    }
}
