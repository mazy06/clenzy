package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
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
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PayzonePaymentProvider}.
 *
 * <h2>Pourquoi des tests unitaires sur Payzone</h2>
 * <p>Payzone n'a pas de sandbox public — il faut donc valider la logique
 * en isolation. Couverture : metadata provider, verification de signature
 * HMAC-SHA256, gestion des cas d'erreur de config, parsing du payload.</p>
 */
class PayzonePaymentProviderTest {

    private PayzoneClient client;
    private PaymentMethodConfigService configService;
    private PayzonePaymentProvider provider;

    @BeforeEach
    void setUp() {
        client = mock(PayzoneClient.class);
        configService = mock(PaymentMethodConfigService.class);
        provider = new PayzonePaymentProvider(client, configService);
        ReflectionTestUtils.setField(provider, "clenzyBaseUrl", "https://app.clenzy.fr");
    }

    // ─── Provider metadata ────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns PAYZONE")
    void getProviderType_returnsPayzone() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.PAYZONE);
    }

    @Test
    @DisplayName("getSupportedCountries = MA uniquement")
    void getSupportedCountries_isMoroccoOnly() {
        assertThat(provider.getSupportedCountries()).containsExactly("MA");
    }

    @Test
    @DisplayName("getSupportedCurrencies inclut MAD")
    void getSupportedCurrencies_includesMad() {
        assertThat(provider.getSupportedCurrencies()).contains("MAD", "EUR", "USD");
    }

    // ─── verifyWebhook ─────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyWebhook accepte une signature HMAC-SHA256 valide")
    void verifyWebhook_validSignature() throws Exception {
        String payload = "{\"merchant_reference\":\"TX-001\",\"status\":\"completed\"}";
        String secret = "payzone_test_secret";
        String signature = computeHmacSha256Hex(payload, secret);
        assertThat(provider.verifyWebhook(payload, signature, secret)).isTrue();
    }

    @Test
    @DisplayName("verifyWebhook refuse un payload tampere")
    void verifyWebhook_tampered_returnsFalse() throws Exception {
        String original = "{\"merchant_reference\":\"TX-001\",\"amount\":100}";
        String tampered = "{\"merchant_reference\":\"TX-001\",\"amount\":1}";
        String secret = "secret";
        String signature = computeHmacSha256Hex(original, secret);
        assertThat(provider.verifyWebhook(tampered, signature, secret)).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook refuse un mauvais secret")
    void verifyWebhook_wrongSecret_returnsFalse() throws Exception {
        String payload = "{\"merchant_reference\":\"TX-001\"}";
        String signature = computeHmacSha256Hex(payload, "real_secret");
        assertThat(provider.verifyWebhook(payload, signature, "wrong_secret")).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook refuse signature null/vide")
    void verifyWebhook_nullSignature() {
        assertThat(provider.verifyWebhook("payload", null, "secret")).isFalse();
        assertThat(provider.verifyWebhook("payload", "", "secret")).isFalse();
    }

    // ─── createPayment ────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment réussit avec config valide")
    void createPayment_success() {
        PaymentMethodConfig config = buildEnabledConfig("payzone_api_key", true);
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.PAYZONE))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("payzone_api_key");

        when(client.createPayment(any(PayzoneClient.PayzoneCreatePaymentParams.class)))
            .thenReturn(new PayzoneClient.PayzonePaymentResponse(
                "PZN-12345", "https://checkout.payzone.ma/PZN-12345"));

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-001", "MAD"));

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("PZN-12345");
        assertThat(result.redirectUrl()).contains("checkout.payzone.ma");
    }

    @Test
    @DisplayName("createPayment échoue si provider disabled")
    void createPayment_disabled_fails() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-002", "MAD"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("not enabled");
    }

    @Test
    @DisplayName("createPayment échoue si api_key manquante")
    void createPayment_missingApiKey_fails() {
        PaymentMethodConfig config = buildEnabledConfig(null, true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn(null);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-003", "MAD"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("api_key");
    }

    @Test
    @DisplayName("createPayment échoue si orgId metadata absent")
    void createPayment_missingOrgId_fails() {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("transactionRef", "TX-004");
        PaymentRequest request = new PaymentRequest(
            BigDecimal.valueOf(100), "MAD", "Test", "guest@x.com", "Guest",
            "url", "url", "TX-004", metadata);

        PaymentResult result = provider.createPayment(request);
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("orgId");
    }

    // ─── Refund / payout ──────────────────────────────────────────────────

    @Test
    @DisplayName("refundPayment(String) sans contexte renvoie failure explicative")
    void refundPayment_stringSignature_failsWithoutContext() {
        PaymentResult result = provider.refundPayment("PZN-001", BigDecimal.TEN, "reason");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("RefundContext");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) success appelle POST /v1/payments/{id}/refund")
    void refundPayment_withContext_success() {
        PaymentMethodConfig config = buildEnabledConfig("api_key", true);
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.PAYZONE))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("api_key");
        when(client.refundPayment(any(PayzoneClient.PayzoneRefundParams.class)))
            .thenReturn(new PayzoneClient.PayzoneRefundResponse("RFND-PZN-001", true, "succeeded"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "PZN-123", "TX-001", "MAD", new BigDecimal("250.00"));
        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("100.00"), "Partial");

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("RFND-PZN-001");
        assertThat(result.status()).isEqualTo("REFUNDED");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) avec status non-approved renvoie failure")
    void refundPayment_withContext_notApproved_fails() {
        PaymentMethodConfig config = buildEnabledConfig("api_key", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("api_key");
        when(client.refundPayment(any(PayzoneClient.PayzoneRefundParams.class)))
            .thenReturn(new PayzoneClient.PayzoneRefundResponse("RFND-002", false, "rejected"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "PZN-456", "TX-002", "MAD", new BigDecimal("100"));
        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("100"), "Refund");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("rejected");
    }

    @Test
    @DisplayName("createPayout non supporté")
    void createPayout_unsupported() {
        org.assertj.core.api.Assertions
            .assertThatThrownBy(() -> provider.createPayout(null))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private PaymentMethodConfig buildEnabledConfig(String apiKey, boolean sandbox) {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setOrganizationId(42L);
        config.setEnabled(true);
        config.setApiKeyEncrypted(apiKey);
        config.setSandboxMode(sandbox);
        Map<String, Object> json = new HashMap<>();
        json.put("webhookUrl", "https://api.clenzy.fr/api/webhooks/payments/payzone");
        config.setConfigJson(json);
        return config;
    }

    private PaymentRequest buildRequest(Long orgId, String txRef, String currency) {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orgId", String.valueOf(orgId));
        metadata.put("transactionRef", txRef);
        return new PaymentRequest(
            BigDecimal.valueOf(250), currency, "Clenzy reservation",
            "guest@example.com", "Guest",
            "https://app.clenzy.fr/success", "https://app.clenzy.fr/cancel",
            txRef, metadata);
    }

    private static String computeHmacSha256Hex(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }
}
