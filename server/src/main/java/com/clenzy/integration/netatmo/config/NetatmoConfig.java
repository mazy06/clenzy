package com.clenzy.integration.netatmo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Netatmo (OAuth2 + API Connect).
 * Les identifiants proviennent des variables d'environnement (defauts vides) :
 * NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET, NETATMO_REDIRECT_URI.
 *
 * Scopes par defaut couvrant les 3 familles supportees :
 * - read_station                          : station meteo (temp/humidite/bruit/CO2)
 * - read_thermostat / write_thermostat    : thermostat + vannes
 * - read_camera / access_camera           : cameras interieures (Welcome)
 * - read_presence / access_presence       : cameras exterieures (Presence)
 * - read_smokedetector                    : detecteur de fumee
 */
@Configuration
public class NetatmoConfig {

    @Value("${netatmo.api.base-url:https://api.netatmo.com}")
    private String apiBaseUrl;

    @Value("${netatmo.oauth.client-id:${NETATMO_CLIENT_ID:}}")
    private String clientId;

    @Value("${netatmo.oauth.client-secret:${NETATMO_CLIENT_SECRET:}}")
    private String clientSecret;

    @Value("${netatmo.oauth.redirect-uri:${NETATMO_REDIRECT_URI:}}")
    private String redirectUri;

    @Value("${netatmo.oauth.authorization-url:https://api.netatmo.com/oauth2/authorize}")
    private String authorizationUrl;

    @Value("${netatmo.oauth.token-url:https://api.netatmo.com/oauth2/token}")
    private String tokenUrl;

    @Value("${netatmo.oauth.scopes:read_station read_thermostat write_thermostat read_camera access_camera read_presence access_presence read_smokedetector}")
    private String scopes;

    // ─── Getters ────────────────────────────────────────────────

    public String getApiBaseUrl() { return apiBaseUrl; }
    public String getClientId() { return clientId; }
    public String getClientSecret() { return clientSecret; }
    public String getRedirectUri() { return redirectUri; }
    public String getAuthorizationUrl() { return authorizationUrl; }
    public String getTokenUrl() { return tokenUrl; }
    public String getScopes() { return scopes; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isEmpty()
                && clientSecret != null && !clientSecret.isEmpty()
                && redirectUri != null && !redirectUri.isEmpty();
    }
}
