package com.clenzy.integration.google.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Google Vacation Rentals.
 *
 * Google utilise le Travel Partner API avec authentification par service account.
 * Les donnees (ARI : Availability, Rates, Inventory) sont poussees vers Google
 * Hotel Center via des feeds structures.
 *
 * Pour obtenir l'acces :
 * 1. S'inscrire sur Google Hotel Center (https://hotelcenter.google.com)
 * 2. Creer un projet Google Cloud et activer l'API Travel Partner
 * 3. Creer un service account et telecharger la cle JSON
 * 4. Configurer le partner_id dans Hotel Center
 */
@Configuration
public class GoogleVacationRentalsConfig {

    @Value("${google.vacation-rentals.api.base-url:https://www.googleapis.com/travelpartner/v3}")
    private String apiBaseUrl;

    @Value("${google.vacation-rentals.partner-id:}")
    private String partnerId;

    @Value("${google.vacation-rentals.service-account-key-path:}")
    private String serviceAccountKeyPath;

    @Value("${google.vacation-rentals.sync.enabled:false}")
    private boolean syncEnabled;

    @Value("${google.vacation-rentals.sync.interval-minutes:30}")
    private int syncIntervalMinutes;

    // Getters

    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    public String getPartnerId() {
        return partnerId;
    }

    public String getServiceAccountKeyPath() {
        return serviceAccountKeyPath;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public int getSyncIntervalMinutes() {
        return syncIntervalMinutes;
    }

    /**
     * Verifie que la configuration Google Vacation Rentals est complete.
     */
    public boolean isConfigured() {
        return partnerId != null && !partnerId.isEmpty()
                && serviceAccountKeyPath != null && !serviceAccountKeyPath.isEmpty();
    }
}
