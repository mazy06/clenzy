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
 * Tests unitaires pour {@link AttijariPaymentProvider} (POC).
 *
 * <p>Miroir de {@link CmiPaymentProviderTest} : meme protocole est3Dgate, meme
 * machinerie ({@link CmiHashService}). On couvre la logique business du provider
 * (validation credentials/devise, redirectUrl, operations non supportees,
 * metadata) et la reutilisation du hash service partage.</p>
 */
class AttijariPaymentProviderTest {

    private CmiHashService hashService;
    private PaymentMethodConfigService configService;
    private AttijariPaymentProvider provider;

    @BeforeEach
    void setUp() {
        hashService = new CmiHashService(); // instance reelle : hash partage est3Dgate
        configService = mock(PaymentMethodConfigService.class);
        provider = new AttijariPaymentProvider(hashService, configService);
        ReflectionTestUtils.setField(provider, "clenzyBaseUrl", "https://app.clenzy.fr");
    }

    // ─── Provider metadata ────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns ATTIJARI")
    void getProviderType_returnsAttijari() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.ATTIJARI);
    }

    @Test
    @DisplayName("getSupportedCountries = Morocco only")
    void getSupportedCountries_returnsMaOnly() {
        assertThat(provider.getSupportedCountries()).containsExactly("MA");
    }

    @Test
    @DisplayName("getSupportedCurrencies includes MAD, EUR, USD")
    void getSupportedCurrencies() {
        assertThat(provider.getSupportedCurrencies()).contains("MAD", "EUR", "USD");
    }

    @Test
    @DisplayName("getCapabilities = PAY only (POC scope)")
    void getCapabilities_payOnly() {
        assertThat(provider.getCapabilities())
            .containsExactly(com.clenzy.payment.PaymentCapability.PAY);
    }

    // ─── createPayment ────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment returns redirect URL to internal Clenzy endpoint")
    void createPayment_validConfig_returnsClenzyRedirectUrl() {
        PaymentMethodConfig config = buildEnabledConfig("MERCHANT_001", "STORE_KEY_TEST",
            Map.of("okUrl", "https://app.clenzy.fr/ok", "failUrl", "https://app.clenzy.fr/fail"));
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.ATTIJARI))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("MERCHANT_001");
        when(configService.decryptApiSecret(config)).thenReturn("STORE_KEY_TEST");

        PaymentRequest request = buildRequest(42L, "TX-001", "MAD");
        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("TX-001");
        assertThat(result.redirectUrl())
            .isEqualTo("https://app.clenzy.fr/api/payments/attijari-redirect/TX-001");
    }

    @Test
    @DisplayName("createPayment fails when Attijari provider is disabled")
    void createPayment_disabled_returnsFailure() {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setEnabled(false);
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-002", "MAD"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("not enabled");
    }

    @Test
    @DisplayName("createPayment fails when client_id is missing")
    void createPayment_missingClientId_returnsFailure() {
        PaymentMethodConfig config = buildEnabledConfig(null, "STORE_KEY",
            Map.of("okUrl", "x", "failUrl", "y"));
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn(null);
        when(configService.decryptApiSecret(config)).thenReturn("STORE_KEY");

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-003", "MAD"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("client_id");
    }

    @Test
    @DisplayName("createPayment fails when store_key is missing")
    void createPayment_missingStoreKey_returnsFailure() {
        PaymentMethodConfig config = buildEnabledConfig("MERCHANT_001", null,
            Map.of("okUrl", "x", "failUrl", "y"));
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("MERCHANT_001");
        when(configService.decryptApiSecret(config)).thenReturn(null);

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-004", "MAD"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("store_key");
    }

    @Test
    @DisplayName("createPayment fails for unsupported currency")
    void createPayment_unsupportedCurrency_returnsFailure() {
        PaymentMethodConfig config = buildEnabledConfig("MERCHANT_001", "STORE_KEY",
            Map.of("okUrl", "x", "failUrl", "y"));
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("MERCHANT_001");
        when(configService.decryptApiSecret(config)).thenReturn("STORE_KEY");

        PaymentResult result = provider.createPayment(buildRequest(42L, "TX-005", "JPY"));
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("JPY");
    }

    @Test
    @DisplayName("createPayment fails when orgId metadata is missing")
    void createPayment_missingOrgIdMetadata_returnsFailure() {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("transactionRef", "TX-006");
        PaymentRequest request = new PaymentRequest(
            BigDecimal.valueOf(250), "MAD", "Test", "guest@x.com", "Guest",
            "url", "url", "TX-006", metadata);

        PaymentResult result = provider.createPayment(request);
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("orgId");
    }

    // ─── Refund / payout / customer ────────────────────────────────────────

    @Test
    @DisplayName("refundPayment is not supported (back-office only)")
    void refundPayment_returnsFailure() {
        PaymentResult result = provider.refundPayment("TX-001", BigDecimal.TEN, "reason");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("manuellement");
    }

    @Test
    @DisplayName("createPayout is not supported by Attijari")
    void createPayout_throws() {
        org.assertj.core.api.Assertions
            .assertThatThrownBy(() -> provider.createPayout(null))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("createCustomer returns null (no persistent customer concept)")
    void createCustomer_returnsNull() {
        assertThat(provider.createCustomer(null)).isNull();
    }

    // ─── Gateway URL ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Gateway URL : prod when sandbox=false")
    void gateway_prod() {
        assertThat(AttijariPaymentProvider.resolveGatewayUrl(false))
            .isEqualTo("https://payment.maroctelecommerce.com/fim/est3Dgate");
    }

    @Test
    @DisplayName("Gateway URL : test when sandbox=true")
    void gateway_sandbox() {
        assertThat(AttijariPaymentProvider.resolveGatewayUrl(true))
            .isEqualTo("https://testpayment.maroctelecommerce.com/fim/est3Dgate");
    }

    @Test
    @DisplayName("capturePayment returns success immediately (auto-captures)")
    void capturePayment_returnsSuccess() {
        PaymentResult result = provider.capturePayment("TX-100", BigDecimal.TEN);
        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("TX-100");
    }

    @Test
    @DisplayName("verifyWebhook with empty payload returns false")
    void verifyWebhook_emptyPayload_returnsFalse() {
        assertThat(provider.verifyWebhook("", "ignored", "store-key")).isFalse();
    }

    @Test
    @DisplayName("verifyWebhook with null payload returns false")
    void verifyWebhook_nullPayload_returnsFalse() {
        assertThat(provider.verifyWebhook(null, "ignored", "store-key")).isFalse();
    }

    @Test
    @DisplayName("createPayment uses idempotencyKey when transactionRef metadata missing")
    void createPayment_usesIdempotencyKey() {
        PaymentMethodConfig config = buildEnabledConfig("M", "S", Map.of());
        when(configService.getOrCreateConfig(any(), any())).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("M");
        when(configService.decryptApiSecret(config)).thenReturn("S");

        Map<String, String> meta = new HashMap<>();
        meta.put("orgId", "1");
        PaymentRequest req = new PaymentRequest(
            BigDecimal.TEN, "MAD", "Desc", "g@x.com", "G", "u", "u", "IDEM-1", meta);

        PaymentResult result = provider.createPayment(req);
        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("IDEM-1");
    }

    @Test
    @DisplayName("createPayment returns failure when transactionRef cannot be resolved")
    void createPayment_noTransactionRef_returnsFailure() {
        Map<String, String> meta = new HashMap<>();
        meta.put("orgId", "1");
        PaymentRequest req = new PaymentRequest(
            BigDecimal.TEN, "MAD", "D", "g@x.com", "G", "u", "u", null, meta);

        PaymentResult result = provider.createPayment(req);
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("transactionRef");
    }

    @Test
    @DisplayName("hashService getter returns the shared est3Dgate instance")
    void hashService_returnsInstance() {
        assertThat(provider.hashService()).isSameAs(hashService);
    }

    @Test
    @DisplayName("AttijariCredentials record exposes fields")
    void attijariCredentials_recordAccessors() {
        var creds = new AttijariPaymentProvider.AttijariCredentials(
            "client", "store", "ok", "fail", "cb", true);
        assertThat(creds.clientId()).isEqualTo("client");
        assertThat(creds.storeKey()).isEqualTo("store");
        assertThat(creds.okUrl()).isEqualTo("ok");
        assertThat(creds.failUrl()).isEqualTo("fail");
        assertThat(creds.callbackUrl()).isEqualTo("cb");
        assertThat(creds.sandbox()).isTrue();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private PaymentMethodConfig buildEnabledConfig(String clientId, String storeKey, Map<String, Object> configJson) {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setOrganizationId(42L);
        config.setEnabled(true);
        config.setApiKeyEncrypted(clientId);
        config.setApiSecretEncrypted(storeKey);
        config.setConfigJson(new HashMap<>(configJson));
        return config;
    }

    private PaymentRequest buildRequest(Long orgId, String transactionRef, String currency) {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orgId", String.valueOf(orgId));
        metadata.put("transactionRef", transactionRef);
        return new PaymentRequest(
            BigDecimal.valueOf(250),
            currency,
            "Baitly reservation",
            "guest@example.com",
            "Guest",
            "https://app.clenzy.fr/success",
            "https://app.clenzy.fr/cancel",
            transactionRef,
            metadata);
    }
}
