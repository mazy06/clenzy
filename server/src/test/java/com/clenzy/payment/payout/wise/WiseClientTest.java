package com.clenzy.payment.payout.wise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClient.RequestBodySpec;
import org.springframework.web.client.RestClient.RequestBodyUriSpec;
import org.springframework.web.client.RestClient.ResponseSpec;

import java.io.IOException;
import java.lang.reflect.Field;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link WiseClient}.
 *
 * <p>Strategie : mock RestClient.Builder + chaine fluent. JsonNode est
 * construit via ObjectMapper depuis un text-block JSON pour rester lisible.</p>
 */
class WiseClientTest {

    private RestClient.Builder builder;
    private ObjectMapper objectMapper;
    private WiseClient client;

    @BeforeEach
    void setUp() throws Exception {
        builder = mock(RestClient.Builder.class);
        objectMapper = new ObjectMapper();
        client = new WiseClient(builder, objectMapper);
        setField("apiToken", "tok_test_xxx");
        setField("profileId", "12345");
        setField("sandbox", true);
    }

    private void setField(String name, Object value) throws Exception {
        Field f = WiseClient.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(client, value);
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
        lenient().when(responseSpec.toBodilessEntity()).thenReturn(ResponseEntity.ok().build());

        JsonNode node = objectMapper.readTree(responseJson);
        lenient().when(responseSpec.body(eq(JsonNode.class))).thenReturn(node);
    }

    private void stubBuilderToThrowOnRetrieve() {
        RestClient mockClient = mock(RestClient.class);
        RequestBodyUriSpec uriSpec = mock(RequestBodyUriSpec.class);
        RequestBodySpec bodySpec = mock(RequestBodySpec.class);

        lenient().when(builder.build()).thenReturn(mockClient);
        lenient().when(mockClient.post()).thenReturn(uriSpec);
        lenient().when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.accept(any(MediaType[].class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.retrieve()).thenThrow(new RuntimeException("Network error"));
    }

    // ─── isEnabled ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("isEnabled")
    class IsEnabled {
        @Test
        void whenTokenAndProfileSet_thenTrue() {
            assertThat(client.isEnabled()).isTrue();
        }

        @Test
        void whenTokenBlank_thenFalse() throws Exception {
            setField("apiToken", "");
            assertThat(client.isEnabled()).isFalse();
        }

        @Test
        void whenProfileNull_thenFalse() throws Exception {
            setField("profileId", null);
            assertThat(client.isEnabled()).isFalse();
        }

        @Test
        void whenTokenNull_thenFalse() throws Exception {
            setField("apiToken", null);
            assertThat(client.isEnabled()).isFalse();
        }
    }

    // ─── createRecipient ───────────────────────────────────────────────────

    @Nested
    @DisplayName("createRecipient")
    class CreateRecipient {
        @Test
        void whenSuccess_returnsId() throws IOException {
            String resp = """
                    {"id":"42","accountHolderName":"John Doe"}""";
            stubBuilderToReturnJson(resp);

            String id = client.createRecipient("FR7612345678", "John Doe", "EUR", "PRIVATE");

            assertThat(id).isEqualTo("42");
        }

        @Test
        void whenLegalTypeNull_defaultsToPrivate() throws IOException {
            String resp = """
                    {"id":"77"}""";
            stubBuilderToReturnJson(resp);

            String id = client.createRecipient("FR76", "Jane", "EUR", null);

            assertThat(id).isEqualTo("77");
        }

        @Test
        void whenIdAbsent_throws() throws IOException {
            String resp = """
                    {"accountHolderName":"X"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createRecipient("FR76", "X", "EUR", "PRIVATE"))
                    .isInstanceOf(WiseClient.WiseApiException.class)
                    .hasMessageContaining("id absent");
        }

        @Test
        void whenHttpFailure_wrapsAsApiException() {
            stubBuilderToThrowOnRetrieve();

            assertThatThrownBy(() -> client.createRecipient("FR76", "X", "EUR", null))
                    .isInstanceOf(WiseClient.WiseApiException.class)
                    .hasMessageContaining("Wise createRecipient failed");
        }
    }

    // ─── createQuote ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("createQuote")
    class CreateQuote {
        @Test
        void whenSuccess_returnsQuoteWithAmounts() throws IOException {
            String resp = """
                    {"id":"q1","targetAmount":"99.50","fee":"0.50"}""";
            stubBuilderToReturnJson(resp);

            WiseClient.WiseQuote quote = client.createQuote(
                    new BigDecimal("100"), "EUR", "EUR", "42");

            assertThat(quote.quoteId()).isEqualTo("q1");
            assertThat(quote.targetAmount()).isEqualByComparingTo("99.50");
            assertThat(quote.feeAmount()).isEqualByComparingTo("0.50");
        }

        @Test
        void whenNoTargetRecipient_thenStillOk() throws IOException {
            String resp = """
                    {"id":"q2"}""";
            stubBuilderToReturnJson(resp);

            WiseClient.WiseQuote quote = client.createQuote(
                    new BigDecimal("50"), "EUR", "EUR", null);

            assertThat(quote.quoteId()).isEqualTo("q2");
            assertThat(quote.targetAmount()).isNull();
            assertThat(quote.feeAmount()).isNull();
        }

        @Test
        void whenIdAbsent_throws() throws IOException {
            String resp = """
                    {"sourceAmount":"100"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createQuote(
                    new BigDecimal("100"), "EUR", "EUR", "42"))
                    .isInstanceOf(WiseClient.WiseApiException.class)
                    .hasMessageContaining("id absent");
        }

        @Test
        void whenHttpFailure_wrapsAsApiException() {
            stubBuilderToThrowOnRetrieve();

            assertThatThrownBy(() -> client.createQuote(
                    new BigDecimal("100"), "EUR", "EUR", "42"))
                    .isInstanceOf(WiseClient.WiseApiException.class);
        }
    }

    // ─── createTransfer ────────────────────────────────────────────────────

    @Nested
    @DisplayName("createTransfer")
    class CreateTransfer {
        @Test
        void whenSuccess_returnsId() throws IOException {
            String resp = """
                    {"id":99999,"status":"incoming_payment_waiting"}""";
            stubBuilderToReturnJson(resp);

            String id = client.createTransfer("q1", "42", 17L, "ref1");

            assertThat(id).isEqualTo("99999");
        }

        @Test
        void whenNullReference_thenDefaultReferenceUsed() throws IOException {
            String resp = """
                    {"id":12345}""";
            stubBuilderToReturnJson(resp);

            String id = client.createTransfer("q1", "42", 18L, null);

            assertThat(id).isEqualTo("12345");
        }

        @Test
        void whenIdAbsent_throws() throws IOException {
            String resp = """
                    {"status":"FAILED"}""";
            stubBuilderToReturnJson(resp);

            assertThatThrownBy(() -> client.createTransfer("q1", "42", 17L, "ref"))
                    .isInstanceOf(WiseClient.WiseApiException.class)
                    .hasMessageContaining("id absent");
        }

        @Test
        void whenHttpFailure_wraps() {
            stubBuilderToThrowOnRetrieve();

            assertThatThrownBy(() -> client.createTransfer("q1", "42", 17L, "ref"))
                    .isInstanceOf(WiseClient.WiseApiException.class);
        }
    }

    // ─── fundTransfer ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("fundTransfer")
    class FundTransfer {
        @Test
        void whenSuccess_noException() throws IOException {
            // Even though fundTransfer uses .toBodilessEntity(), the stub setup
            // chains correctly. The JSON returned via .body() is unused.
            stubBuilderToReturnJson("{}");

            client.fundTransfer("99999");
            // No exception = success
        }

        @Test
        void whenHttpFailure_wraps() {
            stubBuilderToThrowOnRetrieve();

            assertThatThrownBy(() -> client.fundTransfer("99999"))
                    .isInstanceOf(WiseClient.WiseApiException.class);
        }
    }

    // ─── DTOs ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DTOs and exceptions")
    class Dtos {
        @Test
        void wiseQuote_recordValues() {
            WiseClient.WiseQuote q = new WiseClient.WiseQuote("q-id", new BigDecimal("9"), new BigDecimal("1"));
            assertThat(q.quoteId()).isEqualTo("q-id");
            assertThat(q.targetAmount()).isEqualByComparingTo("9");
            assertThat(q.feeAmount()).isEqualByComparingTo("1");
        }

        @Test
        void apiException_messageOnly() {
            WiseClient.WiseApiException e = new WiseClient.WiseApiException("oops");
            assertThat(e.getMessage()).isEqualTo("oops");
        }

        @Test
        void apiException_withCause() {
            RuntimeException cause = new RuntimeException("inner");
            WiseClient.WiseApiException e = new WiseClient.WiseApiException("oops", cause);
            assertThat(e.getCause()).isSameAs(cause);
        }
    }
}
