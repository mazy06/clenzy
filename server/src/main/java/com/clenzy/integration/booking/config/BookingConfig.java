package com.clenzy.integration.booking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Booking.com.
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Booking.com utilise une API XML (OTA standard) avec authentification
 * HTTP Basic (username/password fournis par Booking.com via l'Extranet partenaire).
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur le Connectivity Partner Programme de Booking.com
 * 2. Obtenir l'acces a l'API Supply XML
 * 3. Recuperer username, password et hotel_id depuis l'Extranet
 */
@Configuration
public class BookingConfig {

    @Value("${booking.api.base-url:https://supply-xml.booking.com/hotels/xml}")
    private String apiBaseUrl;

    @Value("${booking.api.username:}")
    private String username;

    @Value("${booking.api.password:}")
    private String password;

    @Value("${booking.api.hotel-id:}")
    private String hotelId;

    @Value("${booking.webhook.secret:}")
    private String webhookSecret;

    @Value("${booking.sync.interval-minutes:10}")
    private int syncIntervalMinutes;

    @Value("${booking.sync.enabled:false}")
    private boolean syncEnabled;

    // Getters

    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public String getHotelId() {
        return hotelId;
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
     * Verifie que la configuration Booking.com est complete.
     */
    public boolean isConfigured() {
        return username != null && !username.isEmpty()
                && password != null && !password.isEmpty()
                && hotelId != null && !hotelId.isEmpty();
    }
}
