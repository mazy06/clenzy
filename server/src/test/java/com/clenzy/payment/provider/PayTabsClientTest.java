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

/**
 * Tests unitaires pour {@link PayTabsClient}.
 *
 * Strategie : mock RestClient.Builder + chaine fluent, fournir des JsonNode
 * reponses simulees pour createPayment et refundPayment.
 */
class PayTabsClientTest {

    private RestClient.Builder builder;
    private ObjectMapper objectMapper;
    private PayTabsClient client;

    @BeforeEach
    void setUp() {
        builder = mock(RestClient.Builder.class);
        objectMapper = new ObjectMapper();
        client = new PayTabsClient(builder, objectMapper);
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

    private PayTabsClient.PayTabsCreatePaymentParams sampleCreateParams(String region) {
        return new PayTabsClient.PayTabsCreatePaymentParams(
                "SK-XYZ", 12345L, region,
                "CART-1", "EUR", new BigDecimal("99.99"),
                "Clenzy reservation",
                "https://app/cb", "https://app/return",
                "John Doe", "john@example.com");
    }

    private PayTabsClient.PayTabsRefundParams sampleRefundParams() {
        return new PayTabsClient.PayTabsRefundParams(
                "SK-XYZ", 12345L, "SA",
                "CART-1", "EUR", new BigDecimal("50.00"),
                "Customer complaint", "TRAN-001");
    }

    // ── createPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPayment")
    class CreatePayment {
        @Test
        void success_returnsTranRefAndUrl() throws IOException {
            String resp = """
                {"tran_ref":"TRAN-001","redirect_url":"https://secure.paytabs.sa/p/123"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("SA"));

            assertThat(response.tranRef()).isEqualTo("TRAN-001");
            assertThat(response.redirectUrl()).isEqualTo("https://secure.paytabs.sa/p/123");
        }

        @Test
        void regionAE_resolvesPayTabsCom() throws IOException {
            String resp = """
                {"tran_ref":"T-AE","redirect_url":"https://secure.paytabs.com/x"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("AE"));

            assertThat(response.tranRef()).isEqualTo("T-AE");
        }

        @Test
        void regionEG_resolvesEgyptHost() throws IOException {
            String resp = """
                {"tran_ref":"T-EG","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("EG"));

            assertThat(response.tranRef()).isEqualTo("T-EG");
        }

        @Test
        void regionUnknown_fallsBackToGlobal() throws IOException {
            String resp = """
                {"tran_ref":"T-G","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("UNKNOWN"));

            assertThat(response.tranRef()).isEqualTo("T-G");
        }

        @Test
        void regionLowercase_resolves() throws IOException {
            String resp = """
                {"tran_ref":"T-jo","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("jo"));

            assertThat(response.tranRef()).isEqualTo("T-jo");
        }

        @Test
        void nullRegion_fallsBackToGlobal() throws IOException {
            String resp = """
                {"tran_ref":"T-N","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams(null));

            assertThat(response.tranRef()).isEqualTo("T-N");
        }

        @Test
        void blankRegion_fallsBackToGlobal() throws IOException {
            String resp = """
                {"tran_ref":"T-B","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(sampleCreateParams("   "));

            assertThat(response.tranRef()).isEqualTo("T-B");
        }

        @Test
        void customerDetailsNull_stillSucceeds() throws IOException {
            String resp = """
                {"tran_ref":"T-NC","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsCreatePaymentParams params = new PayTabsClient.PayTabsCreatePaymentParams(
                    "SK", 1L, "SA", "C-1", "USD", BigDecimal.TEN, "desc",
                    "cb", "ret", null, null);
            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(params);

            assertThat(response.tranRef()).isEqualTo("T-NC");
        }

        @Test
        void customerNameOnly_succeeds() throws IOException {
            String resp = """
                {"tran_ref":"T-N1","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsCreatePaymentParams params = new PayTabsClient.PayTabsCreatePaymentParams(
                    "SK", 1L, "SA", "C-1", "USD", BigDecimal.TEN, "desc",
                    "cb", "ret", "Alice", null);
            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(params);

            assertThat(response.tranRef()).isEqualTo("T-N1");
        }

        @Test
        void customerEmailOnly_succeeds() throws IOException {
            String resp = """
                {"tran_ref":"T-E1","redirect_url":"u"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsCreatePaymentParams params = new PayTabsClient.PayTabsCreatePaymentParams(
                    "SK", 1L, "SA", "C-1", "USD", BigDecimal.TEN, "desc",
                    "cb", "ret", null, "u@e.com");
            PayTabsClient.PayTabsPaymentResponse response = client.createPayment(params);

            assertThat(response.tranRef()).isEqualTo("T-E1");
        }

        @Test
        void nullResponse_throwsApiException() {
            stubBuilderToReturnNull();

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams("SA")))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("empty response");
        }

        @Test
        void missingTranRef_throwsWithAppCode() throws IOException {
            String resp = """
                {"code":"401","message":"Invalid profile id"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams("SA")))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("401");
        }

        @Test
        void missingRedirectUrl_throws() throws IOException {
            String resp = """
                {"tran_ref":"T-1"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams("SA")))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class);
        }

        @Test
        void networkError_wrappedInApiException() {
            stubBuilderToThrow();

            assertThatThrownBy(() -> client.createPayment(sampleCreateParams("SA")))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("failed");
        }
    }

    // ── refundPayment ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {
        @Test
        void approved_returnsApprovedTrue() throws IOException {
            String resp = """
                {"tran_ref":"RFND-001","payment_result":{"response_status":"A"}}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.tranRef()).isEqualTo("RFND-001");
            assertThat(response.approved()).isTrue();
        }

        @Test
        void declined_returnsApprovedFalse() throws IOException {
            String resp = """
                {"tran_ref":"RFND-002","payment_result":{"response_status":"D"}}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.approved()).isFalse();
        }

        @Test
        void noPaymentResult_returnsApprovedFalse() throws IOException {
            String resp = """
                {"tran_ref":"RFND-003"}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsRefundResponse response = client.refundPayment(sampleRefundParams());

            assertThat(response.approved()).isFalse();
        }

        @Test
        void nullReason_usesDefaultRefundLabel() throws IOException {
            String resp = """
                {"tran_ref":"RFND-004","payment_result":{"response_status":"A"}}""";
            stubBuilderToReturnJson(resp);

            PayTabsClient.PayTabsRefundParams params = new PayTabsClient.PayTabsRefundParams(
                    "SK", 1L, "SA", "C-1", "EUR", BigDecimal.ONE, null, "TRAN-X");
            PayTabsClient.PayTabsRefundResponse response = client.refundPayment(params);

            assertThat(response.tranRef()).isEqualTo("RFND-004");
        }

        @Test
        void nullResponse_throws() {
            stubBuilderToReturnNull();

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("empty refund response");
        }

        @Test
        void missingTranRef_throws() throws IOException {
            String resp = """
                {"payment_result":{"response_status":"A"}}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("no tran_ref");
        }

        @Test
        void networkError_wrappedInApiException() {
            stubBuilderToThrow();

            assertThatThrownBy(() -> client.refundPayment(sampleRefundParams()))
                    .isInstanceOf(PayTabsClient.PayTabsApiException.class)
                    .hasMessageContaining("refund call failed");
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DTOs and exceptions")
    class Dtos {
        @Test
        void paymentResponse_recordValues() {
            PayTabsClient.PayTabsPaymentResponse r = new PayTabsClient.PayTabsPaymentResponse("tref", "url");
            assertThat(r.tranRef()).isEqualTo("tref");
            assertThat(r.redirectUrl()).isEqualTo("url");
        }

        @Test
        void refundResponse_recordValues() {
            PayTabsClient.PayTabsRefundResponse r = new PayTabsClient.PayTabsRefundResponse("rid", true);
            assertThat(r.tranRef()).isEqualTo("rid");
            assertThat(r.approved()).isTrue();
        }

        @Test
        void createParams_recordValues() {
            PayTabsClient.PayTabsCreatePaymentParams p = new PayTabsClient.PayTabsCreatePaymentParams(
                    "k", 1L, "SA", "C", "EUR", BigDecimal.TEN, "d", "cb", "r", "n", "e@x");
            assertThat(p.profileId()).isEqualTo(1L);
            assertThat(p.amount()).isEqualByComparingTo(BigDecimal.TEN);
            assertThat(p.region()).isEqualTo("SA");
        }

        @Test
        void refundParams_recordValues() {
            PayTabsClient.PayTabsRefundParams r = new PayTabsClient.PayTabsRefundParams(
                    "k", 1L, "AE", "C", "EUR", BigDecimal.ONE, "reason", "T");
            assertThat(r.reason()).isEqualTo("reason");
            assertThat(r.originalTranRef()).isEqualTo("T");
        }

        @Test
        void apiException_messageOnly() {
            PayTabsClient.PayTabsApiException e = new PayTabsClient.PayTabsApiException("oops");
            assertThat(e.getMessage()).isEqualTo("oops");
        }

        @Test
        void apiException_withCause() {
            RuntimeException cause = new RuntimeException("inner");
            PayTabsClient.PayTabsApiException e = new PayTabsClient.PayTabsApiException("oops", cause);
            assertThat(e.getCause()).isSameAs(cause);
        }
    }
}
