package com.clenzy.integration.expedia.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Expedia / VRBO.
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur https://developers.expediagroup.com
 * 2. Creer une application dans le Rapid API dashboard
 * 3. Recuperer api-key et api-secret
 * 4. Configurer le webhook endpoint dans le Partner Central
 */
@Configuration
public class ExpediaConfig {

    @Value("${expedia.api.base-url:https://services.expediapartnercentral.com}")
    private String apiBaseUrl;

    @Value("${expedia.api.key:}")
    private String apiKey;

    @Value("${expedia.api.secret:}")
    private String apiSecret;

    @Value("${expedia.api.property-id:}")
    private String propertyId;

    @Value("${expedia.webhook.secret:}")
    private String webhookSecret;

    @Value("${expedia.sync.interval-minutes:15}")
    private int syncIntervalMinutes;

    @Value("${expedia.sync.enabled:false}")
    private boolean syncEnabled;

    // Getters

    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getApiSecret() {
        return apiSecret;
    }

    public String getPropertyId() {
        return propertyId;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public int getSyncIntervalMinutes() {
        return syncIntervalMinutes;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    /**
     * Verifie que la configuration Expedia est complete.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty()
                && apiSecret != null && !apiSecret.isEmpty();
    }
}
