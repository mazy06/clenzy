package com.clenzy.integration.minut.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinutConfig {

    @Value("${minut.api.base-url:https://api.minut.com/v8}")
    private String apiBaseUrl;

    @Value("${minut.oauth.client-id:}")
    private String clientId;

    @Value("${minut.oauth.client-secret:}")
    private String clientSecret;

    @Value("${minut.oauth.redirect-uri:}")
    private String redirectUri;

    @Value("${minut.oauth.authorization-url:https://api.minut.com/v8/oauth/authorize}")
    private String authorizationUrl;

    @Value("${minut.oauth.token-url:https://api.minut.com/v8/oauth/token}")
    private String tokenUrl;

    @Value("${minut.oauth.scopes:read,write}")
    private String scopes;

    @Value("${minut.webhook.secret:}")
    private String webhookSecret;

    // ─── Getters ────────────────────────────────────────────────

    public String getApiBaseUrl() { return apiBaseUrl; }
    public String getClientId() { return clientId; }
    public String getClientSecret() { return clientSecret; }
    public String getRedirectUri() { return redirectUri; }
    public String getAuthorizationUrl() { return authorizationUrl; }
    public String getTokenUrl() { return tokenUrl; }
    public String getScopes() { return scopes; }
    public String getWebhookSecret() { return webhookSecret; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isEmpty()
                && clientSecret != null && !clientSecret.isEmpty()
                && redirectUri != null && !redirectUri.isEmpty();
    }
}
