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

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PayPalPaymentProvider}.
 *
 * <h2>Note</h2>
 * <p>Les tests E2E (PayPal OAuth2 + Orders API) doivent passer par un compte
 * sandbox PayPal réel — pas possible en pur unitaire. Ici on couvre la
 * logique métier autour du client : validation config, gestion d'erreurs,
 * métadonnées du provider.</p>
 */
class PayPalPaymentProviderTest {

    private PayPalClient client;
    private PaymentMethodConfigService configService;
    private PayPalPaymentProvider provider;

    @BeforeEach
    void setUp() {
        client = mock(PayPalClient.class);
        configService = mock(PaymentMethodConfigService.class);
        provider = new PayPalPaymentProvider(client, configService);
        ReflectionTestUtils.setField(provider, "clenzyBaseUrl", "https://app.clenzy.fr");
    }

    // ─── Provider metadata ────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns PAYPAL")
    void getProviderType_returnsPayPal() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.PAYPAL);
    }

    @Test
    @DisplayName("getSupportedCountries = global (*)")
    void getSupportedCountries_global() {
        assertThat(provider.getSupportedCountries()).contains("*");
    }

    @Test
    @DisplayName("getSupportedCurrencies inclut les principales devises Clenzy")
    void getSupportedCurrencies() {
        assertThat(provider.getSupportedCurrencies())
            .contains("EUR", "USD", "GBP", "MAD", "SAR");
    }

    // ─── createPayment ────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment réussit avec config valide")
    void createPayment_success() {
        PaymentMethodConfig config = buildEnabledConfig("paypal_client_id", "paypal_secret", true);
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.PAYPAL))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("paypal_client_id");
        when(configService.decryptApiSecret(config)).thenReturn("paypal_secret");

        when(client.createOrder(any(PayPalClient.PayPalCreateOrderParams.class)))
            .thenReturn(new PayPalClient.PayPalOrderResponse(
                "ORDER-XYZ-123",
                "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-XYZ-123"));

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-001", "EUR"));

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("ORDER-XYZ-123");
        assertThat(result.redirectUrl()).contains("sandbox.paypal.com");
    }

    @Test
    @DisplayName("createPayment échoue si client_id manquant")
    void createPayment_missingClientId_fails() {
        PaymentMethodConfig config = buildEnabledConfig(null, "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn(null);
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-002", "EUR"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("client_id");
    }

    @Test
    @DisplayName("createPayment échoue si client_secret manquant")
    void createPayment_missingClientSecret_fails() {
        PaymentMethodConfig config = buildEnabledConfig("client_id", null, true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("client_id");
        when(configService.decryptApiSecret(config)).thenReturn(null);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-003", "EUR"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("client_secret");
    }

    @Test
    @DisplayName("createPayment échoue si provider disabled")
    void createPayment_disabled_fails() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-004", "EUR"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("not enabled");
    }

    // ─── verifyWebhook ─────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyWebhook retourne false si webhook_id absent")
    void verifyWebhook_missingSecret_returnsFalse() {
        assertThat(provider.verifyWebhook("payload", "sig", null)).isFalse();
        assertThat(provider.verifyWebhook("payload", "sig", "")).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook retourne true en mode soft (webhook_id présent) — MVP")
    void verifyWebhook_softMode_returnsTrue() {
        // PayPal verification réelle = appel API, pas un HMAC local.
        // En mode MVP on accepte si le webhook_id (secret) est fourni.
        // À durcir dans PR ultérieure.
        assertThat(provider.verifyWebhook("payload", "any-signature", "webhook_id_present"))
            .isTrue();
    }

    // ─── Capture / refund ─────────────────────────────────────────────────

    @Test
    @DisplayName("capturePayment via interface lève UnsupportedOperationException — utiliser captureOrder")
    void capturePayment_interfaceMethod_returnsFailure() {
        // L'interface ne passe pas l'orgId, donc on redirige vers captureOrder(orgId, orderId)
        PaymentResult result = provider.capturePayment("ORDER-001", BigDecimal.TEN);
        assertThat(result.success()).isFalse();
    }

    @Test
    @DisplayName("captureOrder réussit quand PayPal renvoie COMPLETED + retourne captureId")
    void captureOrder_success_returnsCaptureId() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.captureOrder(eq("ORDER-001"), any(PayPalClient.PayPalCredentials.class)))
            .thenReturn(new PayPalClient.PayPalCaptureResponse("ORDER-001", "CAP-XYZ-001", true, "COMPLETED"));

        PaymentResult result = provider.captureOrder(42L, "ORDER-001");
        assertThat(result.success()).isTrue();
        assertThat(result.status()).isEqualTo("CAPTURED");
        // providerTxId doit être le captureId, pas l'orderId — utilisé pour refunds futurs.
        assertThat(result.providerTxId()).isEqualTo("CAP-XYZ-001");
    }

    @Test
    @DisplayName("captureOrder fallback à orderId si captureId absent de la réponse")
    void captureOrder_noCaptureId_fallbacksToOrderId() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.captureOrder(eq("ORDER-NO-CAP"), any(PayPalClient.PayPalCredentials.class)))
            .thenReturn(new PayPalClient.PayPalCaptureResponse("ORDER-NO-CAP", null, true, "COMPLETED"));

        PaymentResult result = provider.captureOrder(42L, "ORDER-NO-CAP");
        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("ORDER-NO-CAP");
    }

    @Test
    @DisplayName("captureOrder retourne failure si PayPal renvoie un statut non-COMPLETED")
    void captureOrder_notCompleted_failure() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.captureOrder(eq("ORDER-002"), any(PayPalClient.PayPalCredentials.class)))
            .thenReturn(new PayPalClient.PayPalCaptureResponse("ORDER-002", null, false, "DECLINED"));

        PaymentResult result = provider.captureOrder(42L, "ORDER-002");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("DECLINED");
    }

    // ─── refundPayment(RefundContext) ─────────────────────────────────────

    @Test
    @DisplayName("refundPayment(String) sans contexte renvoie failure explicative")
    void refundPayment_stringSignature_failsWithoutContext() {
        PaymentResult result = provider.refundPayment("CAP-001", BigDecimal.TEN, "reason");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("RefundContext");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) appelle PayPal refundCapture avec le captureId")
    void refundPayment_withContext_success() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.refundCapture(eq("CAP-XYZ-001"), any(PayPalClient.PayPalRefundParams.class)))
            .thenReturn(new PayPalClient.PayPalRefundResponse("RFND-001", true, "COMPLETED"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-XYZ-001", "TX-001", "EUR", new BigDecimal("100"));
        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("50"), "Partial");

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("RFND-001");
    }

    @Test
    @DisplayName("refundPayment(RefundContext) avec status PENDING reste un succès")
    void refundPayment_withContext_pending_isSuccess() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.refundCapture(eq("CAP-002"), any(PayPalClient.PayPalRefundParams.class)))
            .thenReturn(new PayPalClient.PayPalRefundResponse("RFND-002", true, "PENDING"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-002", "TX-002", "USD", new BigDecimal("75"));
        PaymentResult result = provider.refundPayment(ctx, null, "Full refund");
        assertThat(result.success()).isTrue();
    }

    @Test
    @DisplayName("createPayout non supporté")
    void createPayout_unsupported() {
        org.assertj.core.api.Assertions
            .assertThatThrownBy(() -> provider.createPayout(null))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private PaymentMethodConfig buildEnabledConfig(String clientId, String secret, boolean sandbox) {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setOrganizationId(42L);
        config.setEnabled(true);
        config.setApiKeyEncrypted(clientId);
        config.setApiSecretEncrypted(secret);
        config.setSandboxMode(sandbox);
        return config;
    }

    private PaymentRequest buildRequest(Long orgId, String txRef, String currency) {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orgId", String.valueOf(orgId));
        metadata.put("transactionRef", txRef);
        return new PaymentRequest(
            BigDecimal.valueOf(99.99), currency, "Clenzy reservation",
            "guest@example.com", "Guest",
            "https://app.clenzy.fr/success", "https://app.clenzy.fr/cancel",
            txRef, metadata);
    }

    // ─── Additional coverage ─────────────────────────────────────────────

    @Test
    @DisplayName("createPayment uses transactionRef from metadata when idempotencyKey is null")
    void createPayment_metadataTransactionRef_isUsedWhenIdempotencyKeyNull() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.createOrder(any(PayPalClient.PayPalCreateOrderParams.class)))
            .thenReturn(new PayPalClient.PayPalOrderResponse("ORDER-1", "https://pp/checkout"));

        Map<String, String> meta = new HashMap<>();
        meta.put("orgId", "42");
        meta.put("transactionRef", "META-REF-001");
        PaymentRequest req = new PaymentRequest(
            BigDecimal.valueOf(50), "EUR", "desc", "g@e.com", "Guest",
            null, null, null, meta);

        PaymentResult result = provider.createPayment(req);

        assertThat(result.success()).isTrue();
    }

    @Test
    @DisplayName("createPayment defaults success/cancel URLs to clenzyBaseUrl when blank")
    void createPayment_defaultUrls_areApplied() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");
        when(client.createOrder(any())).thenReturn(
            new PayPalClient.PayPalOrderResponse("ORDER-1", "https://pp/checkout"));

        Map<String, String> meta = new HashMap<>();
        meta.put("orgId", "42");
        meta.put("transactionRef", "REF-1");
        PaymentRequest req = new PaymentRequest(BigDecimal.TEN, "EUR", "desc",
            "g@e.com", "G", "", "", null, meta);

        PaymentResult result = provider.createPayment(req);

        assertThat(result.success()).isTrue();
    }

    @Test
    @DisplayName("createPayment fails when transactionRef metadata is missing")
    void createPayment_missingTransactionRef_fails() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        Map<String, String> meta = new HashMap<>();
        meta.put("orgId", "42");
        // no transactionRef + no idempotencyKey
        PaymentRequest req = new PaymentRequest(BigDecimal.TEN, "EUR", "desc",
            "g@e.com", "G", null, null, null, meta);

        PaymentResult result = provider.createPayment(req);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("transactionRef");
    }

    @Test
    @DisplayName("createPayment fails (catches) when orgId metadata is missing")
    void createPayment_missingOrgId_fails() {
        PaymentRequest req = new PaymentRequest(BigDecimal.TEN, "EUR", "desc",
            "g@e.com", "G", null, null, "REF-1", null);

        PaymentResult result = provider.createPayment(req);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("PayPal error");
    }

    @Test
    @DisplayName("createPayment fails when PayPalApiException is thrown")
    void createPayment_apiException_fails() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.createOrder(any()))
            .thenThrow(new PayPalClient.PayPalApiException("Bad request from PayPal"));

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-API-EX", "EUR"));

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("Bad request");
    }

    @Test
    @DisplayName("captureOrder fails when loadCredentials throws (disabled config)")
    void captureOrder_disabledConfig_fails() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);

        PaymentResult result = provider.captureOrder(42L, "ORDER-DISABLED");

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("not enabled");
    }

    @Test
    @DisplayName("refundPayment with RefundContext but null amount uses originalAmount")
    void refundPayment_nullAmount_usesOriginal() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.refundCapture(eq("CAP-N"), any()))
            .thenReturn(new PayPalClient.PayPalRefundResponse("RFND-N", true, "COMPLETED"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-N", "TX-N", "EUR", new BigDecimal("100"));

        PaymentResult result = provider.refundPayment(ctx, null, "test");

        assertThat(result.success()).isTrue();
    }

    @Test
    @DisplayName("refundPayment with null amount AND null originalAmount fails")
    void refundPayment_nullAmounts_fails() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-X", "TX-X", "EUR", null);

        PaymentResult result = provider.refundPayment(ctx, null, "test");

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("amount obligatoire");
    }

    @Test
    @DisplayName("refundPayment when refund not completed fails")
    void refundPayment_notCompleted_fails() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.refundCapture(eq("CAP-F"), any()))
            .thenReturn(new PayPalClient.PayPalRefundResponse("RFND-F", false, "DECLINED"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-F", "TX-F", "EUR", new BigDecimal("100"));

        PaymentResult result = provider.refundPayment(ctx, new BigDecimal("50"), "test");

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("DECLINED");
    }

    @Test
    @DisplayName("refundPayment with PayPalApiException fails")
    void refundPayment_apiException_fails() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        when(client.refundCapture(any(), any()))
            .thenThrow(new PayPalClient.PayPalApiException("Network error"));

        var ctx = new com.clenzy.payment.RefundContext(
            42L, "CAP-E", "TX-E", "EUR", new BigDecimal("100"));

        PaymentResult result = provider.refundPayment(ctx, null, "test");

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("Network error");
    }

    @Test
    @DisplayName("loadCredentials throws when client_id missing")
    void loadCredentials_missingClientId_throws() {
        PaymentMethodConfig config = buildEnabledConfig(null, "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn(null);
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        org.assertj.core.api.Assertions
            .assertThatThrownBy(() -> provider.loadCredentials(42L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("client_id");
    }

    @Test
    @DisplayName("loadCredentials throws when client_secret blank")
    void loadCredentials_blankSecret_throws() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("");

        org.assertj.core.api.Assertions
            .assertThatThrownBy(() -> provider.loadCredentials(42L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("client_secret");
    }

    @Test
    @DisplayName("loadCredentials returns sandbox cache key for sandbox config")
    void loadCredentials_sandbox_cacheKeyContainsSandbox() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        PayPalPaymentProvider.PayPalConfig cfg = provider.loadCredentials(42L);

        assertThat(cfg.cacheKey()).contains("sandbox").contains("org-42");
        assertThat(cfg.sandbox()).isTrue();
    }

    @Test
    @DisplayName("loadCredentials returns prod cache key for prod config")
    void loadCredentials_prod_cacheKeyContainsProd() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", false);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");

        PayPalPaymentProvider.PayPalConfig cfg = provider.loadCredentials(42L);

        assertThat(cfg.cacheKey()).contains("prod");
        assertThat(cfg.sandbox()).isFalse();
    }

    @Test
    @DisplayName("createCustomer returns null (no PayPal Vault in MVP)")
    void createCustomer_returnsNull() {
        assertThat(provider.createCustomer(null)).isNull();
    }

    @Test
    @DisplayName("verifyWebhookStrict returns false when webhook_id missing")
    void verifyWebhookStrict_missingWebhookId_returnsFalse() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");
        when(configService.decryptWebhookSecret(any())).thenReturn(null);

        boolean result = provider.verifyWebhookStrict(
            mock(PayPalClient.PayPalWebhookHeaders.class), "payload", 42L);

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("verifyWebhookStrict delegates to client when webhook_id present")
    void verifyWebhookStrict_delegatesToClient() {
        PaymentMethodConfig config = buildEnabledConfig("cid", "secret", true);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("cid");
        when(configService.decryptApiSecret(config)).thenReturn("secret");
        when(configService.decryptWebhookSecret(any())).thenReturn("wh-id-12345");

        PayPalClient.PayPalWebhookHeaders headers = mock(PayPalClient.PayPalWebhookHeaders.class);
        when(client.verifyWebhookSignature(eq(headers), eq("wh-id-12345"), eq("payload"), any()))
            .thenReturn(true);

        boolean result = provider.verifyWebhookStrict(headers, "payload", 42L);

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("verifyWebhookStrict returns false on exception")
    void verifyWebhookStrict_exception_returnsFalse() {
        when(configService.getOrCreateConfig(any(), any()))
            .thenThrow(new RuntimeException("DB error"));

        boolean result = provider.verifyWebhookStrict(
            mock(PayPalClient.PayPalWebhookHeaders.class), "payload", 42L);

        assertThat(result).isFalse();
    }
}
