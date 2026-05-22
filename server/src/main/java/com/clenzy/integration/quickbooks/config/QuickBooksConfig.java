package com.clenzy.integration.quickbooks.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration QuickBooks Online (Intuit) — OAuth2 Authorization Code Grant.
 * Active uniquement si {@code clenzy.quickbooks.client-id} est defini.
 *
 * <h2>Sandbox vs Production</h2>
 * Endpoints sandbox vs prod identiques cote OAuth (Intuit gere via le compte),
 * mais l'API base URL change : sandbox-quickbooks.api.intuit.com vs
 * quickbooks.api.intuit.com.
 *
 * <h2>realmId</h2>
 * QuickBooks renvoie un parametre {@code realmId} dans le callback (en plus
 * du code et du state). Il identifie la company QuickBooks de l'utilisateur
 * et doit etre stocke pour tous les appels API ulterieurs.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.quickbooks")
@ConditionalOnProperty(name = "clenzy.quickbooks.client-id")
public class QuickBooksConfig {

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String authorizationUrl = "https://appcenter.intuit.com/connect/oauth2";
    private String tokenUrl         = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
    private String revokeUrl        = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
    private String apiBaseUrl       = "https://sandbox-quickbooks.api.intuit.com";
    /** Scopes Authorization Code Grant. accounting = lire/ecrire comptabilite. */
    private String scopes           = "com.intuit.quickbooks.accounting";

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

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public String getScopes() { return scopes; }
    public void setScopes(String scopes) { this.scopes = scopes; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }
}
