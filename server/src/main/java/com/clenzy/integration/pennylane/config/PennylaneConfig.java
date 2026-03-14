package com.clenzy.integration.pennylane.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Pennylane pour la signature electronique et la comptabilite.
 * Active uniquement si clenzy.pennylane.client-id est defini.
 *
 * Supporte deux modes :
 * - Signature electronique (apiUrl existant)
 * - Comptabilite via API Entreprise v2 (OAuth2)
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.pennylane")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneConfig {

    // ─── Champs existants (signature) ────────────────────────────────────────
    private String apiUrl;
    private String clientId;
    private String clientSecret;

    // ─── Champs OAuth2 (comptabilite API Entreprise v2) ──────────────────────
    private String redirectUri;
    private String authorizationUrl = "https://app.pennylane.com/oauth/authorize";
    private String tokenUrl = "https://app.pennylane.com/oauth/token";
    private String revokeUrl = "https://app.pennylane.com/oauth/revoke";
    private String scopes = "customer_invoices:all supplier_invoices:all customers:all suppliers:all journals:readonly ledger_accounts:readonly";
    private String accountingApiBaseUrl = "https://app.pennylane.com/api/external/v2";

    // ─── Getters / Setters — signature ───────────────────────────────────────

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

    // ─── Getters / Setters — OAuth2 ──────────────────────────────────────────

    public String getRedirectUri() {
        return redirectUri;
    }

    public void setRedirectUri(String redirectUri) {
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl() {
        return authorizationUrl;
    }

    public void setAuthorizationUrl(String authorizationUrl) {
        this.authorizationUrl = authorizationUrl;
    }

    public String getTokenUrl() {
        return tokenUrl;
    }

    public void setTokenUrl(String tokenUrl) {
        this.tokenUrl = tokenUrl;
    }

    public String getRevokeUrl() {
        return revokeUrl;
    }

    public void setRevokeUrl(String revokeUrl) {
        this.revokeUrl = revokeUrl;
    }

    public String getScopes() {
        return scopes;
    }

    public void setScopes(String scopes) {
        this.scopes = scopes;
    }

    public String getAccountingApiBaseUrl() {
        return accountingApiBaseUrl;
    }

    public void setAccountingApiBaseUrl(String accountingApiBaseUrl) {
        this.accountingApiBaseUrl = accountingApiBaseUrl;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }

    public boolean isOAuthConfigured() {
        return isConfigured()
            && redirectUri != null && !redirectUri.isBlank();
    }
}
