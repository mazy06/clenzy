package com.clenzy.integration.tripadvisor.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration TripAdvisor Vacation Rentals.
 *
 * TripAdvisor utilise une API REST avec authentification par cle API (API key + secret).
 * Les disponibilites sont poussees vers TripAdvisor et les reservations
 * sont recues par webhook ou recuperees par polling.
 *
 * Pour obtenir l'acces :
 * 1. S'inscrire sur TripAdvisor Connectivity Partner Program
 * 2. Obtenir les credentials API (key + secret)
 * 3. Configurer le webhook URL dans le dashboard partenaire
 */
@Configuration
public class TripAdvisorConfig {

    @Value("${tripadvisor.api.base-url:https://api.tripadvisor.com/api/vacation-rentals/v1}")
    private String apiBaseUrl;

    @Value("${tripadvisor.api.key:}")
    private String apiKey;

    @Value("${tripadvisor.api.secret:}")
    private String apiSecret;

    @Value("${tripadvisor.partner-id:}")
    private String partnerId;

    @Value("${tripadvisor.sync.enabled:false}")
    private boolean syncEnabled;

    @Value("${tripadvisor.sync.interval-minutes:15}")
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

    public String getPartnerId() {
        return partnerId;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public int getSyncIntervalMinutes() {
        return syncIntervalMinutes;
    }

    /**
     * Verifie que la configuration TripAdvisor est complete.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty()
                && apiSecret != null && !apiSecret.isEmpty()
                && partnerId != null && !partnerId.isEmpty();
    }
}
