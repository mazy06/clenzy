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
 * Tests unitaires pour {@link CmiPaymentProvider}.
 *
 * <h2>Focus</h2>
 * <p>Le hash SHA-512 est teste exhaustivement dans {@link CmiHashServiceTest}.
 * Ici on couvre la logique business du provider :</p>
 * <ul>
 *   <li>Validation des credentials (client_id, store_key, devise)</li>
 *   <li>Generation correcte du redirectUrl Clenzy intermediaire</li>
 *   <li>Comportement des operations non supportees (refund, payout)</li>
 *   <li>Metadata du provider (countries, currencies, type)</li>
 * </ul>
 */
class CmiPaymentProviderTest {

    private CmiHashService hashService;
    private PaymentMethodConfigService configService;
    private CmiPaymentProvider provider;

    @BeforeEach
    void setUp() {
        hashService = new CmiHashService(); // real instance, no mock needed
        configService = mock(PaymentMethodConfigService.class);
        provider = new CmiPaymentProvider(hashService, configService);
        ReflectionTestUtils.setField(provider, "clenzyBaseUrl", "https://app.clenzy.fr");
    }

    // ─── Provider metadata ────────────────────────────────────────────────

    @Test
    @DisplayName("getProviderType returns CMI")
    void getProviderType_returnsCmi() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.CMI);
    }

    @Test
    @DisplayName("getSupportedCountries = Morocco only")
    void getSupportedCountries_returnsMaOnly() {
        assertThat(provider.getSupportedCountries()).containsExactly("MA");
    }

    @Test
    @DisplayName("getSupportedCurrencies includes MAD, EUR, USD, GBP")
    void getSupportedCurrencies() {
        assertThat(provider.getSupportedCurrencies()).contains("MAD", "EUR", "USD", "GBP");
    }

    // ─── createPayment ────────────────────────────────────────────────────

    @Test
    @DisplayName("createPayment returns redirect URL to internal Clenzy endpoint")
    void createPayment_validConfig_returnsClenzyRedirectUrl() {
        PaymentMethodConfig config = buildEnabledConfig("MERCHANT_001", "STORE_KEY_TEST",
            Map.of("okUrl", "https://app.clenzy.fr/ok", "failUrl", "https://app.clenzy.fr/fail"));
        when(configService.getOrCreateConfig(eq(42L), eq(PaymentProviderType.CMI))).thenReturn(config);
        when(configService.decryptApiKey(config)).thenReturn("MERCHANT_001");
        when(configService.decryptApiSecret(config)).thenReturn("STORE_KEY_TEST");

        PaymentRequest request = buildRequest(42L, "TX-001", "MAD");
        PaymentResult result = provider.createPayment(request);

        assertThat(result.success()).isTrue();
        assertThat(result.providerTxId()).isEqualTo("TX-001");
        assertThat(result.redirectUrl())
            .isEqualTo("https://app.clenzy.fr/api/payments/cmi-redirect/TX-001");
    }

    @Test
    @DisplayName("createPayment fails when CMI provider is disabled")
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
    @DisplayName("refundPayment is not supported (CMI back-office only)")
    void refundPayment_returnsFailure() {
        PaymentResult result = provider.refundPayment("TX-001", BigDecimal.TEN, "reason");
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("manuellement");
    }

    @Test
    @DisplayName("createPayout is not supported by CMI")
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
        assertThat(CmiPaymentProvider.resolveGatewayUrl(false))
            .isEqualTo("https://payment.cmi.co.ma/fim/est3Dgate");
    }

    @Test
    @DisplayName("Gateway URL : test when sandbox=true")
    void gateway_sandbox() {
        assertThat(CmiPaymentProvider.resolveGatewayUrl(true))
            .isEqualTo("https://testpayment.cmi.co.ma/fim/est3Dgate");
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private PaymentMethodConfig buildEnabledConfig(String clientId, String storeKey, Map<String, Object> configJson) {
        PaymentMethodConfig config = new PaymentMethodConfig();
        config.setOrganizationId(42L);
        config.setEnabled(true);
        // Note : les valeurs stockees en BDD seraient encryptees, mais le mock
        // {@code decryptApiKey/Secret} renvoie les valeurs claires directement.
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
            "Clenzy reservation",
            "guest@example.com",
            "Guest",
            "https://app.clenzy.fr/success",
            "https://app.clenzy.fr/cancel",
            transactionRef,
            metadata);
    }
}
