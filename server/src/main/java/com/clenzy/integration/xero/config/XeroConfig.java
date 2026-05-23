package com.clenzy.integration.xero.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Xero — OAuth2 Authorization Code Grant.
 * Active uniquement si {@code clenzy.xero.client-id} est defini.
 *
 * <h2>Multi-tenant</h2>
 * Xero supporte le multi-tenant : un utilisateur peut autoriser l'acces a
 * plusieurs organisations Xero. Apres echange de code, on appelle
 * {@code GET /connections} pour recuperer la liste des tenants accessibles
 * et stocker le tenant_id selectionne par l'utilisateur (cf. XeroOAuthService).
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.xero")
@ConditionalOnProperty(name = "clenzy.xero.client-id")
public class XeroConfig {

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String authorizationUrl = "https://login.xero.com/identity/connect/authorize";
    private String tokenUrl          = "https://identity.xero.com/connect/token";
    private String revokeUrl         = "https://identity.xero.com/connect/revocation";
    private String connectionsUrl    = "https://api.xero.com/connections";
    private String apiBaseUrl        = "https://api.xero.com";
    /**
     * Scopes Xero. {@code offline_access} est obligatoire pour obtenir un
     * refresh token. {@code accounting.*} pour la sync compta.
     */
    private String scopes = "accounting.transactions accounting.contacts accounting.settings offline_access";

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

    public String getConnectionsUrl() { return connectionsUrl; }
    public void setConnectionsUrl(String connectionsUrl) { this.connectionsUrl = connectionsUrl; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public String getScopes() { return scopes; }
    public void setScopes(String scopes) { this.scopes = scopes; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }
}
