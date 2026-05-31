package com.clenzy.service;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.repository.PaymentMethodConfigRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentMethodConfigServiceTest {

    @Mock private PaymentMethodConfigRepository repository;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private PaymentMethodConfigService service;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        when(repository.save(any(PaymentMethodConfig.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private PaymentMethodConfig sample(PaymentProviderType type) {
        PaymentMethodConfig c = new PaymentMethodConfig();
        c.setOrganizationId(ORG_ID);
        c.setProviderType(type);
        c.setEnabled(true);
        c.setSandboxMode(true);
        return c;
    }

    // ----- getConfigsForOrganization -----

    @Test
    void getConfigsForOrganization_delegatesToRepository() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        when(repository.findByOrganizationId(ORG_ID)).thenReturn(List.of(c));

        List<PaymentMethodConfig> result = service.getConfigsForOrganization(ORG_ID);

        assertThat(result).hasSize(1).contains(c);
    }

    // ----- getEnabledProviders -----

    @Test
    void getEnabledProviders_filtersByCountry() {
        PaymentMethodConfig fr = sample(PaymentProviderType.STRIPE);
        fr.setCountryCodes("FR,DE");
        PaymentMethodConfig ma = sample(PaymentProviderType.CMI);
        ma.setCountryCodes("MA");

        when(repository.findByOrganizationIdAndEnabledTrue(ORG_ID)).thenReturn(List.of(fr, ma));

        List<PaymentMethodConfig> result = service.getEnabledProviders(ORG_ID, "FR");

        assertThat(result).hasSize(1).contains(fr);
    }

    @Test
    void getEnabledProviders_supportsWildcardCountry() {
        PaymentMethodConfig wild = sample(PaymentProviderType.PAYPAL);
        wild.setCountryCodes("*");

        when(repository.findByOrganizationIdAndEnabledTrue(ORG_ID)).thenReturn(List.of(wild));

        List<PaymentMethodConfig> result = service.getEnabledProviders(ORG_ID, "FR");

        assertThat(result).hasSize(1);
    }

    @Test
    void getEnabledProviders_emptyResult_whenNoMatch() {
        PaymentMethodConfig ma = sample(PaymentProviderType.CMI);
        ma.setCountryCodes("MA");

        when(repository.findByOrganizationIdAndEnabledTrue(ORG_ID)).thenReturn(List.of(ma));

        assertThat(service.getEnabledProviders(ORG_ID, "FR")).isEmpty();
    }

    // ----- getOrCreateConfig -----

    @Test
    void getOrCreateConfig_returnsExisting() {
        PaymentMethodConfig existing = sample(PaymentProviderType.STRIPE);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.of(existing));

        PaymentMethodConfig result = service.getOrCreateConfig(ORG_ID, PaymentProviderType.STRIPE);

        assertThat(result).isEqualTo(existing);
        verify(repository, never()).save(any());
    }

    @Test
    void getOrCreateConfig_createsNewWithDefaults() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());

        PaymentMethodConfig result = service.getOrCreateConfig(ORG_ID, PaymentProviderType.STRIPE);

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getProviderType()).isEqualTo(PaymentProviderType.STRIPE);
        assertThat(result.getEnabled()).isFalse();
        assertThat(result.getSandboxMode()).isTrue();
        verify(repository).save(any(PaymentMethodConfig.class));
    }

    // ----- enableProvider -----

    @Test
    void enableProvider_setsEnabledTrueAndCountryCodes() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());

        PaymentMethodConfig result = service.enableProvider(ORG_ID, PaymentProviderType.STRIPE, "FR,DE");

        assertThat(result.getEnabled()).isTrue();
        assertThat(result.getCountryCodes()).isEqualTo("FR,DE");
    }

    @Test
    void enableProvider_nullCountryCodes_preservesExisting() {
        PaymentMethodConfig existing = sample(PaymentProviderType.STRIPE);
        existing.setEnabled(false);
        existing.setCountryCodes("FR");
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.of(existing));

        PaymentMethodConfig result = service.enableProvider(ORG_ID, PaymentProviderType.STRIPE, null);

        assertThat(result.getEnabled()).isTrue();
        assertThat(result.getCountryCodes()).isEqualTo("FR");
    }

    // ----- disableProvider -----

    @Test
    void disableProvider_setsEnabledFalse() {
        PaymentMethodConfig existing = sample(PaymentProviderType.STRIPE);
        existing.setEnabled(true);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.of(existing));

        PaymentMethodConfig result = service.disableProvider(ORG_ID, PaymentProviderType.STRIPE);

        assertThat(result.getEnabled()).isFalse();
    }

    // ----- updateConfig (full signature) -----

    @Test
    void updateConfig_encryptsAllCredentials() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());
        when(encryptionService.encrypt("api-key")).thenReturn("ENC:api-key");
        when(encryptionService.encrypt("api-secret")).thenReturn("ENC:api-secret");
        when(encryptionService.encrypt("webhook-secret")).thenReturn("ENC:webhook-secret");

        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.STRIPE,
            true, "FR", false, "api-key", "api-secret", "webhook-secret", null);

        assertThat(result.getEnabled()).isTrue();
        assertThat(result.getCountryCodes()).isEqualTo("FR");
        assertThat(result.getSandboxMode()).isFalse();
        assertThat(result.getApiKeyEncrypted()).isEqualTo("ENC:api-key");
        assertThat(result.getApiSecretEncrypted()).isEqualTo("ENC:api-secret");
        assertThat(result.getWebhookSecretEncrypted()).isEqualTo("ENC:webhook-secret");
    }

    @Test
    void updateConfig_blankCredentials_notEncrypted() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());

        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.STRIPE,
            null, null, null, "  ", "", null, null);

        assertThat(result.getApiKeyEncrypted()).isNull();
        assertThat(result.getApiSecretEncrypted()).isNull();
        assertThat(result.getWebhookSecretEncrypted()).isNull();
        verify(encryptionService, never()).encrypt(any());
    }

    @Test
    void updateConfig_mergesConfigJsonPreservingExisting() {
        PaymentMethodConfig existing = sample(PaymentProviderType.PAYTABS);
        Map<String, Object> initial = new HashMap<>();
        initial.put("region", "EU");
        existing.setConfigJson(initial);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.PAYTABS))
            .thenReturn(Optional.of(existing));

        Map<String, Object> update = Map.of("profileId", "abc-123");
        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.PAYTABS,
            null, null, null, null, null, null, update);

        assertThat(result.getConfigJson()).containsEntry("region", "EU");
        assertThat(result.getConfigJson()).containsEntry("profileId", "abc-123");
    }

    @Test
    void updateConfig_overwritesConfigJsonKeysOnConflict() {
        PaymentMethodConfig existing = sample(PaymentProviderType.PAYTABS);
        Map<String, Object> initial = new HashMap<>();
        initial.put("profileId", "OLD");
        existing.setConfigJson(initial);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.PAYTABS))
            .thenReturn(Optional.of(existing));

        Map<String, Object> update = Map.of("profileId", "NEW");
        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.PAYTABS,
            null, null, null, null, null, null, update);

        assertThat(result.getConfigJson()).containsEntry("profileId", "NEW");
    }

    @Test
    void updateConfig_configJsonNoExisting_createsNew() {
        PaymentMethodConfig existing = sample(PaymentProviderType.PAYTABS);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.PAYTABS))
            .thenReturn(Optional.of(existing));

        Map<String, Object> update = Map.of("profileId", "xyz");
        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.PAYTABS,
            null, null, null, null, null, null, update);

        assertThat(result.getConfigJson()).containsEntry("profileId", "xyz");
    }

    @Test
    void updateConfig_emptyConfigJson_doesNotTouch() {
        PaymentMethodConfig existing = sample(PaymentProviderType.PAYTABS);
        Map<String, Object> initial = new HashMap<>();
        initial.put("region", "EU");
        existing.setConfigJson(initial);
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.PAYTABS))
            .thenReturn(Optional.of(existing));

        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.PAYTABS,
            null, null, null, null, null, null, Map.of());

        assertThat(result.getConfigJson()).containsEntry("region", "EU");
    }

    @Test
    void updateConfig_3argSignature_delegatesToFullWithoutCredentials() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());

        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.STRIPE,
            true, "FR", false);

        assertThat(result.getEnabled()).isTrue();
        assertThat(result.getCountryCodes()).isEqualTo("FR");
        assertThat(result.getSandboxMode()).isFalse();
        assertThat(result.getApiKeyEncrypted()).isNull();
    }

    @Test
    void updateConfig_7argSignature_includesCredentials() {
        when(repository.findByOrganizationIdAndProviderType(ORG_ID, PaymentProviderType.STRIPE))
            .thenReturn(Optional.empty());
        when(encryptionService.encrypt("api-key")).thenReturn("ENC:api-key");

        PaymentMethodConfig result = service.updateConfig(ORG_ID, PaymentProviderType.STRIPE,
            true, "FR", false, "api-key", null, null);

        assertThat(result.getApiKeyEncrypted()).isEqualTo("ENC:api-key");
        assertThat(result.getApiSecretEncrypted()).isNull();
    }

    // ----- decrypt* methods -----

    @Test
    void decryptApiKey_returnsNullIfNotSet() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        assertThat(service.decryptApiKey(c)).isNull();
        verify(encryptionService, never()).decrypt(any());
    }

    @Test
    void decryptApiKey_delegatesToEncryptionService() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        c.setApiKeyEncrypted("ENC:foo");
        when(encryptionService.decrypt("ENC:foo")).thenReturn("foo");

        assertThat(service.decryptApiKey(c)).isEqualTo("foo");
    }

    @Test
    void decryptApiSecret_returnsNullIfNotSet() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        assertThat(service.decryptApiSecret(c)).isNull();
    }

    @Test
    void decryptApiSecret_delegates() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        c.setApiSecretEncrypted("ENC:secret");
        when(encryptionService.decrypt("ENC:secret")).thenReturn("secret");

        assertThat(service.decryptApiSecret(c)).isEqualTo("secret");
    }

    @Test
    void decryptWebhookSecret_returnsNullIfNotSet() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        assertThat(service.decryptWebhookSecret(c)).isNull();
    }

    @Test
    void decryptWebhookSecret_delegates() {
        PaymentMethodConfig c = sample(PaymentProviderType.STRIPE);
        c.setWebhookSecretEncrypted("ENC:wh");
        when(encryptionService.decrypt("ENC:wh")).thenReturn("wh");

        assertThat(service.decryptWebhookSecret(c)).isEqualTo("wh");
    }

    // ----- getDefaultProvidersForCountry -----

    @Test
    void getDefaultProvidersForCountry_FR_returnsStripe() {
        assertThat(service.getDefaultProvidersForCountry("FR"))
            .containsExactly(PaymentProviderType.STRIPE);
    }

    @Test
    void getDefaultProvidersForCountry_MA_returnsCmiAndPayzone() {
        assertThat(service.getDefaultProvidersForCountry("MA"))
            .containsExactly(PaymentProviderType.CMI, PaymentProviderType.PAYZONE);
    }

    @Test
    void getDefaultProvidersForCountry_SA_returnsPaytabs() {
        assertThat(service.getDefaultProvidersForCountry("SA"))
            .containsExactly(PaymentProviderType.PAYTABS);
    }

    @Test
    void getDefaultProvidersForCountry_unknown_returnsGlobalFallback() {
        assertThat(service.getDefaultProvidersForCountry("ZZ"))
            .containsExactly(PaymentProviderType.STRIPE, PaymentProviderType.PAYPAL);
    }

    @Test
    void getDefaultProvidersForCountry_null_throwsNpe() {
        // COUNTRY_DEFAULTS is built with Map.of which rejects null keys at lookup.
        // Document the current behavior rather than masking it.
        assertThatThrownBy(() -> service.getDefaultProvidersForCountry(null))
            .isInstanceOf(NullPointerException.class);
    }
}
