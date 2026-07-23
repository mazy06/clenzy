package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.service.PaymentMethodConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link YouCanPayPaymentProvider} (mirror des tests Payzone) :
 * metadata provider, tokenize + redirection, signature webhook HMAC-SHA256,
 * refus explicite du refund (pas d'API publique).
 */
class YouCanPayPaymentProviderTest {

    private YouCanPayClient client;
    private PaymentMethodConfigService configService;
    private YouCanPayPaymentProvider provider;

    @BeforeEach
    void setUp() {
        client = mock(YouCanPayClient.class);
        configService = mock(PaymentMethodConfigService.class);
        provider = new YouCanPayPaymentProvider(client, configService);
        ReflectionTestUtils.setField(provider, "baseUrl", "https://app.clenzy.fr");
    }

    // ─── Provider metadata ────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns YOUCAN_PAY")
    void getProviderType_returnsYouCanPay() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.YOUCAN_PAY);
    }

    @Test
    @DisplayName("capabilities = PAY uniquement (refund via dashboard)")
    void getCapabilities_isPayOnly() {
        assertThat(provider.getCapabilities()).containsExactly(PaymentCapability.PAY);
    }

    @Test
    @DisplayName("Maroc / MAD uniquement")
    void supportedCountriesAndCurrencies() {
        assertThat(provider.getSupportedCountries()).containsExactly("MA");
        assertThat(provider.getSupportedCurrencies()).containsExactly("MAD");
    }

    // ─── createPayment ─────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment tokenize en centimes et retourne l'URL de paiement")
    void createPayment_success() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(true);
        config.setSandboxMode(true);
        when(configService.getOrCreateConfig(1L, PaymentProviderType.YOUCAN_PAY)).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("pri_test_key");
        when(client.tokenize(any())).thenReturn(
            new YouCanPayClient.YouCanPayTokenResponse(
                "tok-123", "https://youcanpay.com/sandbox/payment-form/tok-123"));

        PaymentRequest request = new PaymentRequest(
            new BigDecimal("450.50"), "MAD", "Réservation Riad", "guest@mail.ma", "Guest",
            "https://ok", "https://ko", "TX-42", Map.of("orgId", "1"));

        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("tok-123");
        assertThat(result.redirectUrl()).contains("payment-form/tok-123");

        var captor = org.mockito.ArgumentCaptor.forClass(YouCanPayClient.YouCanPayTokenizeParams.class);
        org.mockito.Mockito.verify(client).tokenize(captor.capture());
        assertThat(captor.getValue().amountMinorUnits()).isEqualTo(45050L);
        assertThat(captor.getValue().orderId()).isEqualTo("TX-42");
        assertThat(captor.getValue().sandbox()).isTrue();
    }

    @Test
    @DisplayName("createPayment échoue proprement si provider désactivé")
    void createPayment_disabled_failure() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(eq(1L), eq(PaymentProviderType.YOUCAN_PAY))).thenReturn(config);

        PaymentRequest request = new PaymentRequest(
            new BigDecimal("100"), "MAD", "Test", null, null,
            null, null, "TX-1", Map.of("orgId", "1"));

        assertThat(provider.createPayment(request).success()).isFalse();
    }

    // ─── refund ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("refundPayment = échec explicite (dashboard uniquement)")
    void refund_isExplicitFailure() {
        PaymentResult result = provider.refundPayment("tok-1", new BigDecimal("10"), "test");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("dashboard");
    }

    // ─── verifyWebhook ─────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyWebhook accepte une signature HMAC-SHA256 valide")
    void verifyWebhook_validSignature() throws Exception {
        String payload = "{\"order_id\":\"TX-42\",\"event_name\":\"transaction.paid\"}";
        String secret = "pri_test_key";
        assertThat(provider.verifyWebhook(payload, hmacHex(payload, secret), secret)).isTrue();
    }

    @Test
    @DisplayName("verifyWebhook refuse un payload tamperé ou une signature absente")
    void verifyWebhook_invalid() throws Exception {
        String payload = "{\"order_id\":\"TX-42\"}";
        String secret = "secret";
        assertThat(provider.verifyWebhook("{\"order_id\":\"TX-1\"}", hmacHex(payload, secret), secret)).isFalse();
        assertThat(provider.verifyWebhook(payload, null, secret)).isFalse();
        assertThat(provider.verifyWebhook(payload, "", secret)).isFalse();
    }

    private static String hmacHex(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }
}
