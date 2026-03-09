package com.clenzy.integration.pennylane.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Pennylane pour la signature electronique et la comptabilite.
 * Active uniquement si clenzy.pennylane.client-id est defini.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.pennylane")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneConfig {

    private String apiUrl;
    private String clientId;
    private String clientSecret;

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }
}
