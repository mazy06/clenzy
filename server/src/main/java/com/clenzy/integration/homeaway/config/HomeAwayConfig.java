package com.clenzy.integration.homeaway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration HomeAway/Abritel (Vrbo Group).
 * Toutes les valeurs sont externalisees via variables d'environnement.
 *
 * Pour obtenir les credentials :
 * 1. S'inscrire sur https://www.vrbo.com/platform/partner-api
 * 2. Creer une application dans le dashboard developpeur
 * 3. Configurer les redirect URIs pour OAuth 2.0
 * 4. Recuperer client_id et client_secret
 */
@Configuration
public class HomeAwayConfig {

    @Value("${homeaway.api.base-url:https://ws.homeaway.com/public}")
    private String apiBaseUrl;

    @Value("${homeaway.oauth.client-id:}")
    private String clientId;

    @Value("${homeaway.oauth.client-secret:}")
    private String clientSecret;

    @Value("${homeaway.oauth.redirect-uri:}")
    private String redirectUri;

    @Value("${homeaway.oauth.authorization-url:https://ws.homeaway.com/oauth/authorize}")
    private String authorizationUrl;

    @Value("${homeaway.oauth.token-url:https://ws.homeaway.com/oauth/token}")
    private String tokenUrl;

    @Value("${homeaway.webhook.secret:}")
    private String webhookSecret;

    @Value("${homeaway.sync.enabled:false}")
    private boolean syncEnabled;

    @Value("${homeaway.sync.interval-minutes:15}")
    private int syncIntervalMinutes;

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

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public int getSyncIntervalMinutes() {
        return syncIntervalMinutes;
    }

    /**
     * Verifie que la configuration HomeAway est complete.
     */
    public boolean isConfigured() {
        return clientId != null && !clientId.isEmpty()
                && clientSecret != null && !clientSecret.isEmpty()
                && redirectUri != null && !redirectUri.isEmpty();
    }
}
