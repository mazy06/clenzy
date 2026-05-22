package com.clenzy.integration.sage.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Sage Business Cloud Accounting — OAuth2 Authorization Code Grant.
 * Active uniquement si {@code clenzy.sage.client-id} est defini.
 *
 * <p>Sage Business Cloud expose une API REST stable depuis 2018, scope unique
 * {@code full_access}. Apres connexion, on appelle {@code GET /businesses}
 * pour lister les entreprises et stocker celle choisie par l'utilisateur.</p>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.sage")
@ConditionalOnProperty(name = "clenzy.sage.client-id")
public class SageConfig {

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String authorizationUrl = "https://www.sageone.com/oauth2/auth/central";
    private String tokenUrl          = "https://oauth.accounting.sage.com/token";
    private String revokeUrl         = "https://oauth.accounting.sage.com/revoke";
    private String businessesUrl     = "https://api.accounting.sage.com/v3.1/businesses";
    private String apiBaseUrl        = "https://api.accounting.sage.com/v3.1";
    /** Scope unique de Sage Business Cloud Accounting. */
    private String scopes = "full_access";

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

    public String getRedirectUri() { return redirectUri; }
    public void setRedirectUri(String redirectUri) { this.redirectUri = redirectUri; }

    public String getAuthorizationUrl() { return authorizationUrl; }
    public void setAuthorizationUrl(String authorizationUrl) { this.authorizationUrl = authorizationUrl; }

    public String getTokenUrl() { return tokenUrl; }
    public void setTokenUrl(String tokenUrl) { this.tokenUrl = tokenUrl; }

    public String getRevokeUrl() { return revokeUrl; }
    public void setRevokeUrl(String revokeUrl) { this.revokeUrl = revokeUrl; }

    public String getBusinessesUrl() { return businessesUrl; }
    public void setBusinessesUrl(String businessesUrl) { this.businessesUrl = businessesUrl; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public String getScopes() { return scopes; }
    public void setScopes(String scopes) { this.scopes = scopes; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }
}
