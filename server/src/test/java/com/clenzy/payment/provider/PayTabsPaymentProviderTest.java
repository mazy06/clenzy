package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.service.PaymentMethodConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PayTabsPaymentProvider}.
 *
 * <h2>Couverture</h2>
 * <ul>
 *   <li>{@code verifyWebhook} : signature valide / invalide / cas null / casse</li>
 *   <li>{@code createPayment} : succes nominal, erreur de config (provider
 *       disabled, server_key manquant, profile_id manquant)</li>
 *   <li>{@code getProviderType}, {@code getSupportedCountries}, {@code getSupportedCurrencies}</li>
 * </ul>
 *
 * <h2>Pourquoi pas TestContainers</h2>
 * <p>Le provider est stateless : les dependances sont {@link PayTabsClient}
 * (HTTP) et {@link PaymentMethodConfigService}. On mocke ces deux et on teste
 * la logique de derivation des params + verification de signature
 * uniquement.</p>
 */
class PayTabsPaymentProviderTest {

    private PayTabsClient client;
    private PaymentMethodConfigService configService;
    private PayTabsPaymentProvider provider;

    @BeforeEach
    void setUp() {
        client = mock(PayTabsClient.class);
        configService = mock(PaymentMethodConfigService.class);
        provider = new PayTabsPaymentProvider(client, configService);
    }

    // ─── Provider metadata ─────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns PAYTABS")
    void getProviderType_returnsPaytabs() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.PAYTABS);
    }

    @Test
    @DisplayName("getSupportedCountries includes KSA and Gulf states")
    void getSupportedCountries_includesGccStates() {
        assertThat(provider.getSupportedCountries())
            .contains("SA", "AE", "BH", "KW", "OM", "QA", "EG", "JO");
    }

    @Test
    @DisplayName("getSupportedCurrencies includes SAR and Gulf currencies")
    void getSupportedCurrencies_includesGccCurrencies() {
        assertThat(provider.getSupportedCurrencies())
            .contains("SAR", "AED", "BHD", "KWD", "OMR", "QAR", "EGP", "USD");
    }

    // ─── verifyWebhook ─────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyWebhook returns true for a valid HMAC-SHA256 signature")
    void verifyWebhook_validSignature_returnsTrue() throws Exception {
        String payload = "{\"cart_id\":\"TX-abc123\",\"payment_result\":{\"response_status\":\"A\"}}";
        String secret = "test_server_key_xyz";
        String signature = computeHmacSha256Hex(payload, secret);

        assertThat(provider.verifyWebhook(payload, signature, secret)).isTrue();
    }

    @Test
    @DisplayName("verifyWebhook is case-insensitive on the hex signature")
    void verifyWebhook_isCaseInsensitive() throws Exception {
        String payload = "{\"cart_id\":\"TX-abc123\"}";
        String secret = "test_secret";
        String signatureUpper = computeHmacSha256Hex(payload, secret).toUpperCase();

        assertThat(provider.verifyWebhook(payload, signatureUpper, secret)).isTrue();
    }

    @Test
    @DisplayName("verifyWebhook returns false for a tampered payload")
    void verifyWebhook_tamperedPayload_returnsFalse() throws Exception {
        String original = "{\"cart_id\":\"TX-abc123\",\"amount\":100}";
        String tampered = "{\"cart_id\":\"TX-abc123\",\"amount\":1}";
        String secret = "test_server_key";
        String signature = computeHmacSha256Hex(original, secret);

        assertThat(provider.verifyWebhook(tampered, signature, secret)).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook returns false for a wrong secret")
    void verifyWebhook_wrongSecret_returnsFalse() throws Exception {
        String payload = "{\"cart_id\":\"TX-abc123\"}";
        String correctSecret = "real_secret";
        String wrongSecret = "wrong_secret";
        String signature = computeHmacSha256Hex(payload, correctSecret);

        assertThat(provider.verifyWebhook(payload, signature, wrongSecret)).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook returns false for null signature")
    void verifyWebhook_nullSignature_returnsFalse() {
        assertThat(provider.verifyWebhook("payload", null, "secret")).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook returns false for null secret")
    void verifyWebhook_nullSecret_returnsFalse() {
        assertThat(provider.verifyWebhook("payload", "deadbeef", null)).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook returns false for blank signature")
    void verifyWebhook_blankSignature_returnsFalse() {
        assertThat(provider.verifyWebhook("payload", "   ", "secret")).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook returns false for shorter signature (different length)")
    void verifyWebhook_signatureLengthMismatch_returnsFalse() {
        assertThat(provider.verifyWebhook("payload", "abc", "secret")).isFalse();
    }

    // ─── createPayment ─────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment with valid config returns success with tran_ref and redirect_url")
    void createPayment_validConfig_returnsSuccess() {
        // Arrange
        PaymentMethodConfig config = buildEnabledConfig("test_server_key", 12345L, "SA");
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.PAYTABS))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("test_server_key");

        when(client.createPayment(any(PayTabsClient.PayTabsCreatePaymentParams.class)))
            .thenReturn(new PayTabsClient.PayTabsPaymentResponse(
                "TST123456789", "https://secure.paytabs.sa/payment/page/abc"));

        PaymentRequest request = buildPaymentRequest(42L, "TX-test-001");

        // Act
        PaymentResult result = provider.createPayment(request);

        // Assert
        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("TST123456789");
        assertThat(result.redirectUrl()).startsWith("https://secure.paytabs.sa");
    }

    @Test
    @DisplayName("createPayment fails when provider is disabled for the org")
    void createPayment_disabledProvider_returnsFailure() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(anyLong(), any())).thenReturn(config);

        PaymentRequest request = buildPaymentRequest(42L, "TX-test-002");

        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("not enabled");
    }

    @Test
    @DisplayName("createPayment fails when server_key is missing")
    void createPayment_missingServerKey_returnsFailure() {
        PaymentMethodConfig config = buildEnabledConfig(null, 12345L, "SA");
        when(configService.getOrCreateConfig(anyLong(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn(null);

        PaymentRequest request = buildPaymentRequest(42L, "TX-test-003");

        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("server_key");
    }

    @Test
    @DisplayName("createPayment fails when profile_id is missing from config_json")
    void createPayment_missingProfileId_returnsFailure() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(true);
        config.setConfigJson(new HashMap<>()); // pas de profileId
        when(configService.getOrCreateConfig(anyLong(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("server_key");

        PaymentRequest request = buildPaymentRequest(42L, "TX-test-004");

        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("profile_id");
    }

    // ─── refundPayment (RefundContext) ────────────────────────────────────

    @Test
    @DisplayName("refundPayment(String) sans contexte renvoie une failure explicative")
    void refundPayment_stringSignature_failsWithoutContext() {
        PaymentResult result = provider.refundPayment("TST123", new BigDecimal("100"), "test");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("RefundContext");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) appelle correctement le client avec cart_id reconstruit")
    void refundPayment_withContext_callsClient() {
        PaymentMethodConfig config = buildEnabledConfig("test_server_key", 12345L, "SA");
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.PAYTABS))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("test_server_key");

        when(client.refundPayment(any(PayTabsClient.PayTabsRefundParams.class)))
            .thenReturn(new PayTabsClient.PayTabsRefundResponse("RFND-001", true));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "TST123", "TX-original-001", "SAR", new BigDecimal("250.00"));
        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("50.00"), "Partial refund");

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("RFND-001");
        assertThat(result.status()).isEqualTo("REFUNDED");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) avec amount null utilise originalAmount du contexte")
    void refundPayment_withContext_nullAmount_usesOriginalAmount() {
        PaymentMethodConfig config = buildEnabledConfig("test_server_key", 12345L, "SA");
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("test_server_key");
        when(client.refundPayment(any(PayTabsClient.PayTabsRefundParams.class)))
            .thenReturn(new PayTabsClient.PayTabsRefundResponse("RFND-002", true));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "TST456", "TX-002", "SAR", new BigDecimal("500.00"));
        PaymentResult result = provider.refundPayment(ctx, null, "Full refund");

        assertThat(result.success()).isTrue();
    }

    @Test
    @DisplayName("refundPayment(RefundContext) refuse si PayTabs renvoie approved=false")
    void refundPayment_withContext_notApproved_fails() {
        PaymentMethodConfig config = buildEnabledConfig("k", 1L, "SA");
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("k");
        when(client.refundPayment(any(PayTabsClient.PayTabsRefundParams.class)))
            .thenReturn(new PayTabsClient.PayTabsRefundResponse("RFND-003", false));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "TST789", "TX-003", "SAR", new BigDecimal("100"));
        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("100"), "Refund");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("refusé");
    }

    @Test
    @DisplayName("createPayment fails when orgId metadata is missing")
    void createPayment_missingOrgIdMetadata_returnsFailure() {
        Map<String, String> metadata = new HashMap<>(); // pas d'orgId
        metadata.put("transactionRef", "TX-test-005");
        PaymentRequest request = new PaymentRequest(
            BigDecimal.valueOf(100), "SAR", "Test", "guest@example.com", "Guest",
            "https://app.clenzy.fr/success", "https://app.clenzy.fr/cancel",
            "TX-test-005", metadata);

        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("orgId");
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private PaymentMethodConfig buildEnabledConfig(String serverKey, Long profileId, String region) {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setOrganizationId(42L);
        config.setEnabled(true);
        config.setApiKeyEncrypted(serverKey); // pour le test, on stocke en clair
        Map<String, Object> json = new HashMap<>();
        if (profileId != null) json.put("profileId", profileId);
        if (region != null) json.put("region", region);
        config.setConfigJson(json);
        return config;
    }

    private PaymentRequest buildPaymentRequest(Long orgId, String transactionRef) {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orgId", String.valueOf(orgId));
        metadata.put("transactionRef", transactionRef);
        return new PaymentRequest(
            BigDecimal.valueOf(250).setScale(2),
            "SAR",
            "Clenzy reservation #ABC123",
            "guest@example.com",
            "Guest Name",
            "https://app.clenzy.fr/success",
            "https://app.clenzy.fr/cancel",
            transactionRef,
            metadata);
    }

    /** HMAC-SHA256 reference calculation, used to seed test signatures. */
    private static String computeHmacSha256Hex(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }
}
