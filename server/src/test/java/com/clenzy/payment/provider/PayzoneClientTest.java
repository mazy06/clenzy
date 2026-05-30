package com.clenzy.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
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

import java.io.IOException;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

class PayzoneClientTest {

    private RestClient.Builder builder;
    private ObjectMapper objectMapper;
    private PayzoneClient client;

    @BeforeEach
    void setUp() {
        builder = mock(RestClient.Builder.class);
        objectMapper = new ObjectMapper();
        client = new PayzoneClient(builder, objectMapper);
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
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);

        JsonNode node = objectMapper.readTree(responseJson);
        lenient().when(responseSpec.body(eq(JsonNode.class))).thenReturn(node);
    }

    private void stubBuilderToReturnNull() {
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
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);

        lenient().when(responseSpec.body(eq(JsonNode.class))).thenReturn(null);
    }

    private void stubBuilderToThrow() {
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
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);
        lenient().when(responseSpec.body(eq(JsonNode.class)))
                .thenThrow(new RuntimeException("network down"));
    }

    private PayzoneClient.PayzoneCreatePaymentParams sampleCreateParams(boolean sandbox) {
        return new PayzoneClient.PayzoneCreatePaymentParams(
                "API-KEY", sandbox, "REF-001", "MAD",
                new BigDecimal("123.45"), "Description",
                "https://app/success", "https://app/failure", "https://app/webhook",
                "guest@example.com", "Jane");
    }

    private PayzoneClient.PayzoneRefundParams sampleRefundParams() {
        return new PayzoneClient.PayzoneRefundParams(
                "API-KEY", false, "TX-001", new BigDecimal("50.00"), "Customer request");
    }

    // ── createPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPayment")
    class CreatePayment {
        @Test
        void success_returnsTxIdAndUrl() throws IOException {
            String resp = """
                {"id":"TX-AAA","checkout_url":"https://payzone.ma/pay/TX-AAA"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzonePaymentResponse response = client.createPayment(sampleCreateParams(false));

            assertThat(response.transactionId()).isEqualTo("TX-AAA");
            assertThat(response.redirectUrl()).contains("payzone.ma");
        }

        @Test
        void sandbox_usesSandboxBaseUrl() throws IOException {
            String resp = """
                {"id":"TX-SBX","checkout_url":"https://sandbox-api.payzone.ma/x"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzonePaymentResponse response = client.createPayment(sampleCreateParams(true));

            assertThat(response.transactionId()).isEqualTo("TX-SBX");
        }

        @Test
        void customerEmailOnly_succeeds() throws IOException {
            String resp = """
                {"id":"TX-EM","checkout_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneCreatePaymentParams params = new PayzoneClient.PayzoneCreatePaymentParams(
                    "K", false, "R", "MAD", BigDecimal.TEN, "d",
                    "s", "f", "w", "e@x", null);
            PayzoneClient.PayzonePaymentResponse response = client.createPayment(params);

            assertThat(response.transactionId()).isEqualTo("TX-EM");
        }

        @Test
        void customerNameOnly_succeeds() throws IOException {
            String resp = """
                {"id":"TX-N","checkout_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneCreatePaymentParams params = new PayzoneClient.PayzoneCreatePaymentParams(
                    "K", false, "R", "MAD", BigDecimal.TEN, "d",
                    "s", "f", "w", null, "Bob");
            PayzoneClient.PayzonePaymentResponse response = client.createPayment(params);

            assertThat(response.transactionId()).isEqualTo("TX-N");
        }

        @Test
        void noCustomerInfo_succeeds() throws IOException {
            String resp = """
                {"id":"TX-NC","checkout_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneCreatePaymentParams params = new PayzoneClient.PayzoneCreatePaymentParams(
                    "K", false, "R", "MAD", BigDecimal.TEN, "d",
                    "s", "f", "w", null, null);
            PayzoneClient.PayzonePaymentResponse response = client.createPayment(params);

            assertThat(response.transactionId()).isEqualTo("TX-NC");
        }

        @Test
        void nullResponse_throws() {
            stubBuilderToReturnNull();

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams(false)))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("empty response");
        }

        @Test
        void missingId_throws() throws IOException {
            String resp = """
                {"checkout_url":"u"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams(false)))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("id ou checkout_url absent");
        }

        @Test
        void missingCheckoutUrl_throws() throws IOException {
            String resp = """
                {"id":"TX"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams(false)))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class);
        }

        @Test
        void networkError_wrappedInApiException() {
            stubBuilderToThrow();

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams(false)))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("API call failed");
        }
    }

    // ── refundPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {
        @Test
        void succeededStatus_returnsApproved() throws IOException {
            String resp = """
                {"id":"RFND-1","status":"succeeded"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.refundId()).isEqualTo("RFND-1");
            assertThat(response.approved()).isTrue();
            assertThat(response.status()).isEqualTo("succeeded");
        }

        @Test
        void completedStatus_returnsApproved() throws IOException {
            String resp = """
                {"id":"RFND-2","status":"completed"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.approved()).isTrue();
        }

        @Test
        void approvedStatus_returnsApproved() throws IOException {
            String resp = """
                {"id":"RFND-3","status":"APPROVED"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.approved()).isTrue();
        }

        @Test
        void pendingStatus_returnsNotApproved() throws IOException {
            String resp = """
                {"id":"RFND-4","status":"pending"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.approved()).isFalse();
            assertThat(response.status()).isEqualTo("pending");
        }

        @Test
        void noStatusInResponse_defaultsToApproved() throws IOException {
            String resp = """
                {"id":"RFND-5"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(sampleRefundParams());

            // status null → approved=true (par convention du code)
            assertThat(response.approved()).isTrue();
            assertThat(response.status()).isNull();
        }

        @Test
        void nullReason_omitsField() throws IOException {
            String resp = """
                {"id":"RFND-6","status":"succeeded"}""";
            stubBuilderToReturnJson(resp);

            PayzoneClient.PayzoneRefundParams params = new PayzoneClient.PayzoneRefundParams(
                    "K", false, "T-1", BigDecimal.TEN, null);
            PayzoneClient.PayzoneRefundResponse response = client.refundPayment(params);

            assertThat(response.refundId()).isEqualTo("RFND-6");
        }

        @Test
        void nullResponse_throws() {
            stubBuilderToReturnNull();

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("empty refund response");
        }

        @Test
        void missingId_throws() throws IOException {
            String resp = """
                {"status":"succeeded"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("id absent");
        }

        @Test
        void networkError_wrappedInApiException() {
            stubBuilderToThrow();

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayzoneClient.PayzoneApiException.class)
                    .hasMessageContaining("refund call failed");
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DTOs and exception")
    class Dtos {
        @Test
        void paymentResponse_recordValues() {
            PayzoneClient.PayzonePaymentResponse r = new PayzoneClient.PayzonePaymentResponse("tx", "url");
            assertThat(r.transactionId()).isEqualTo("tx");
            assertThat(r.redirectUrl()).isEqualTo("url");
        }

        @Test
        void refundResponse_recordValues() {
            PayzoneClient.PayzoneRefundResponse r = new PayzoneClient.PayzoneRefundResponse(
                    "rid", true, "succeeded");
            assertThat(r.refundId()).isEqualTo("rid");
            assertThat(r.status()).isEqualTo("succeeded");
        }

        @Test
        void createParams_recordValues() {
            PayzoneClient.PayzoneCreatePaymentParams p = new PayzoneClient.PayzoneCreatePaymentParams(
                    "k", true, "R", "MAD", BigDecimal.TEN, "d", "s", "f", "w", "e", "n");
            assertThat(p.sandbox()).isTrue();
            assertThat(p.merchantReference()).isEqualTo("R");
            assertThat(p.amount()).isEqualByComparingTo(BigDecimal.TEN);
        }

        @Test
        void refundParams_recordValues() {
            PayzoneClient.PayzoneRefundParams r = new PayzoneClient.PayzoneRefundParams(
                    "k", false, "T", BigDecimal.ONE, "r");
            assertThat(r.transactionId()).isEqualTo("T");
            assertThat(r.reason()).isEqualTo("r");
        }

        @Test
        void apiException_messageOnly() {
            PayzoneClient.PayzoneApiException e = new PayzoneClient.PayzoneApiException("oops");
            assertThat(e.getMessage()).isEqualTo("oops");
        }

        @Test
        void apiException_withCause() {
            RuntimeException cause = new RuntimeException("inner");
            PayzoneClient.PayzoneApiException e = new PayzoneClient.PayzoneApiException("oops", cause);
            assertThat(e.getCause()).isSameAs(cause);
        }
    }
}
