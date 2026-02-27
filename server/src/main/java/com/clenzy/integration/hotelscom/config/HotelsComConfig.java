package com.clenzy.integration.hotelscom.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Hotels.com (Expedia Group).
 * Hotels.com partage l'infrastructure API d'Expedia Partner Central.
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur https://expediapartnersolutions.com
 * 2. Acceder au Expedia Partner Central
 * 3. Recuperer API key et secret dans la section Developer
 */
@Configuration
public class HotelsComConfig {

    @Value("${hotelscom.api.base-url:https://services.expediapartnercentral.com}")
    private String apiBaseUrl;

    @Value("${hotelscom.api.key:}")
    private String apiKey;

    @Value("${hotelscom.api.secret:}")
    private String apiSecret;

    @Value("${hotelscom.property-id:}")
    private String propertyId;

    @Value("${hotelscom.sync.enabled:false}")
    private boolean syncEnabled;

    @Value("${hotelscom.sync.interval-minutes:15}")
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
     * Verifie que la configuration Hotels.com est complete.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty()
                && apiSecret != null && !apiSecret.isEmpty();
    }
}
