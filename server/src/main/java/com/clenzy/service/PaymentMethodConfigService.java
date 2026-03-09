package com.clenzy.service;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.repository.PaymentMethodConfigRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@Transactional
public class PaymentMethodConfigService {

    private static final Logger log = LoggerFactory.getLogger(PaymentMethodConfigService.class);

    private final PaymentMethodConfigRepository repository;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;

    /** Default providers per country */
    private static final Map<String, List<PaymentProviderType>> COUNTRY_DEFAULTS = Map.of(
        "FR", List.of(PaymentProviderType.STRIPE),
        "MA", List.of(PaymentProviderType.CMI, PaymentProviderType.PAYZONE),
        "SA", List.of(PaymentProviderType.PAYTABS)
    );

    public PaymentMethodConfigService(PaymentMethodConfigRepository repository,
                                       TokenEncryptionService encryptionService,
                                       TenantContext tenantContext) {
        this.repository = repository;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
    }

    /**
     * Get all payment configs for an organization.
     */
    @Transactional(readOnly = true)
    public List<PaymentMethodConfig> getConfigsForOrganization(Long orgId) {
        return repository.findByOrganizationId(orgId);
    }

    /**
     * Get enabled providers for an organization, filtered by country.
     */
    @Transactional(readOnly = true)
    public List<PaymentMethodConfig> getEnabledProviders(Long orgId, String countryCode) {
        return repository.findByOrganizationIdAndEnabledTrue(orgId).stream()
            .filter(c -> c.supportsCountry(countryCode))
            .toList();
    }

    /**
     * Get or create config for a specific provider.
     */
    public PaymentMethodConfig getOrCreateConfig(Long orgId, PaymentProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(orgId, providerType)
            .orElseGet(() -> {
                PaymentMethodConfig config = new PaymentMethodConfig();
                config.setOrganizationId(orgId);
                config.setProviderType(providerType);
                config.setEnabled(false);
                config.setSandboxMode(true);
                return repository.save(config);
            });
    }

    /**
     * Enable a payment provider for an organization.
     */
    public PaymentMethodConfig enableProvider(Long orgId, PaymentProviderType providerType,
                                               String countryCodes) {
        PaymentMethodConfig config = getOrCreateConfig(orgId, providerType);
        config.setEnabled(true);
        if (countryCodes != null) {
            config.setCountryCodes(countryCodes);
        }
        log.info("Enabled payment provider {} for org {}", providerType, orgId);
        return repository.save(config);
    }

    /**
     * Disable a payment provider for an organization.
     */
    public PaymentMethodConfig disableProvider(Long orgId, PaymentProviderType providerType) {
        PaymentMethodConfig config = getOrCreateConfig(orgId, providerType);
        config.setEnabled(false);
        log.info("Disabled payment provider {} for org {}", providerType, orgId);
        return repository.save(config);
    }

    /**
     * Update config with encrypted API credentials.
     * API keys, secrets, and webhook secrets are encrypted via AES-256-GCM before storage.
     */
    public PaymentMethodConfig updateConfig(Long orgId, PaymentProviderType providerType,
                                              Boolean enabled, String countryCodes,
                                              Boolean sandboxMode, String apiKey,
                                              String apiSecret, String webhookSecret) {
        PaymentMethodConfig config = getOrCreateConfig(orgId, providerType);
        if (enabled != null) config.setEnabled(enabled);
        if (countryCodes != null) config.setCountryCodes(countryCodes);
        if (sandboxMode != null) config.setSandboxMode(sandboxMode);

        // Encrypt sensitive credentials before storage
        if (apiKey != null && !apiKey.isBlank()) {
            config.setApiKeyEncrypted(encryptionService.encrypt(apiKey));
        }
        if (apiSecret != null && !apiSecret.isBlank()) {
            config.setApiSecretEncrypted(encryptionService.encrypt(apiSecret));
        }
        if (webhookSecret != null && !webhookSecret.isBlank()) {
            config.setWebhookSecretEncrypted(encryptionService.encrypt(webhookSecret));
        }

        log.info("Updated payment config for provider {} org {} (credentials {}encrypted)",
            providerType, orgId, apiKey != null ? "" : "not ");
        return repository.save(config);
    }

    /**
     * Backward-compatible updateConfig without credentials.
     */
    public PaymentMethodConfig updateConfig(Long orgId, PaymentProviderType providerType,
                                              Boolean enabled, String countryCodes,
                                              Boolean sandboxMode) {
        return updateConfig(orgId, providerType, enabled, countryCodes, sandboxMode, null, null, null);
    }

    /**
     * Decrypt API key for runtime use (e.g., building provider requests).
     */
    @Transactional(readOnly = true)
    public String decryptApiKey(PaymentMethodConfig config) {
        if (config.getApiKeyEncrypted() == null) return null;
        return encryptionService.decrypt(config.getApiKeyEncrypted());
    }

    /**
     * Decrypt API secret for runtime use.
     */
    @Transactional(readOnly = true)
    public String decryptApiSecret(PaymentMethodConfig config) {
        if (config.getApiSecretEncrypted() == null) return null;
        return encryptionService.decrypt(config.getApiSecretEncrypted());
    }

    /**
     * Decrypt webhook secret for signature verification.
     */
    @Transactional(readOnly = true)
    public String decryptWebhookSecret(PaymentMethodConfig config) {
        if (config.getWebhookSecretEncrypted() == null) return null;
        return encryptionService.decrypt(config.getWebhookSecretEncrypted());
    }

    /**
     * Get default providers for a country.
     */
    @Transactional(readOnly = true)
    public List<PaymentProviderType> getDefaultProvidersForCountry(String countryCode) {
        List<PaymentProviderType> defaults = COUNTRY_DEFAULTS.get(countryCode);
        if (defaults != null) return defaults;
        // Global fallback
        return List.of(PaymentProviderType.STRIPE, PaymentProviderType.PAYPAL);
    }
}
