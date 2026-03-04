package com.clenzy.integration.hubspot.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration HubSpot pour l'integration CRM et ticketing.
 * Active uniquement si clenzy.hubspot.api-key est defini.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.hubspot")
@ConditionalOnProperty(name = "clenzy.hubspot.api-key")
public class HubSpotConfig {

    private String apiKey;
    private String portalId;

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getPortalId() {
        return portalId;
    }

    public void setPortalId(String portalId) {
        this.portalId = portalId;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
            && portalId != null && !portalId.isBlank();
    }
}
