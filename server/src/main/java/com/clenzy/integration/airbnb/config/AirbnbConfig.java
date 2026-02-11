package com.clenzy.integration.airbnb.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Airbnb.
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur https://developer.airbnb.com
 * 2. Creer une application dans le dashboard
 * 3. Configurer les redirect URIs
 * 4. Recuperer client_id et client_secret
 */
@Configuration
public class AirbnbConfig {

    @Value("${airbnb.api.base-url:https://api.airbnb.com/v2}")
    private String apiBaseUrl;

    @Value("${airbnb.oauth.client-id:}")
    private String clientId;

    @Value("${airbnb.oauth.client-secret:}")
    private String clientSecret;

    @Value("${airbnb.oauth.redirect-uri:}")
    private String redirectUri;

    @Value("${airbnb.oauth.authorization-url:https://www.airbnb.com/oauth2/auth}")
    private String authorizationUrl;

    @Value("${airbnb.oauth.token-url:https://api.airbnb.com/v2/oauth2/authorizations}")
    private String tokenUrl;

    @Value("${airbnb.oauth.scopes:listings_r,reservations_r,reservations_w,calendar_r,calendar_w,messages_r,messages_w}")
    private String scopes;

    @Value("${airbnb.webhook.secret:}")
    private String webhookSecret;

    @Value("${airbnb.sync.interval-minutes:15}")
    private int syncIntervalMinutes;

    @Value("${airbnb.sync.enabled:false}")
    private boolean syncEnabled;

    // Getters

    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    public String getClientId() {
        return clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public String getAuthorizationUrl() {
        return authorizationUrl;
    }

    public String getTokenUrl() {
        return tokenUrl;
    }

    public String getScopes() {
        return scopes;
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
     * Verifie que la configuration Airbnb est complete.
     */
    public boolean isConfigured() {
        return clientId != null && !clientId.isEmpty()
                && clientSecret != null && !clientSecret.isEmpty()
                && redirectUri != null && !redirectUri.isEmpty();
    }
}
