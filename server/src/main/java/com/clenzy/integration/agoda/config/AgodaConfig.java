package com.clenzy.integration.agoda.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Agoda.
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur https://partners.agoda.com
 * 2. Creer une application dans le Supplier API dashboard
 * 3. Recuperer api_key et api_secret
 */
@Configuration
public class AgodaConfig {

    @Value("${agoda.api.base-url:https://supply-api.agoda.com/api/v3}")
    private String apiBaseUrl;

    @Value("${agoda.api.key:}")
    private String apiKey;

    @Value("${agoda.api.secret:}")
    private String apiSecret;

    @Value("${agoda.property-id:}")
    private String propertyId;

    @Value("${agoda.sync.enabled:false}")
    private boolean syncEnabled;

    @Value("${agoda.sync.interval-minutes:15}")
    private int syncIntervalMinutes;

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

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public int getSyncIntervalMinutes() {
        return syncIntervalMinutes;
    }

    /**
     * Verifie que la configuration Agoda est complete.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty()
                && apiSecret != null && !apiSecret.isEmpty();
    }
}
