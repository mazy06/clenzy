package com.clenzy.integration.nuki.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Nuki Web API.
 *
 * Activee uniquement si clenzy.nuki.client-id est defini.
 *
 * Proprietes :
 *   clenzy.nuki.api-url       : URL de base de l'API Nuki (defaut: https://api.nuki.io)
 *   clenzy.nuki.client-id     : Client ID de l'application Nuki
 *   clenzy.nuki.client-secret : Client Secret de l'application Nuki
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.nuki")
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
public class NukiConfig {

    private String apiUrl = "https://api.nuki.io";
    private String clientId;
    private String clientSecret;

    // ─── Getters / Setters ──────────────────────────────────────

    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isEmpty()
                && clientSecret != null && !clientSecret.isEmpty();
    }
}
