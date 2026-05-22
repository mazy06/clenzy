package com.clenzy.integration.docusign.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration DocuSign. Active uniquement si {@code clenzy.docusign.client-id}
 * est defini (l'integration est optionnelle — chaque environnement peut ou non
 * la cabler).
 *
 * <h2>OAuth2 (Authorization Code Grant)</h2>
 * <p>DocuSign supporte aussi le JWT Grant mais on choisit Authorization Code
 * pour rester homogene avec Pennylane (meme moteur OAuth, meme UX cote
 * utilisateur — clic sur "Connecter", consentement, callback).</p>
 *
 * <h2>Sandbox vs Production</h2>
 * <p>Endpoints sandbox : {@code account-d.docusign.com} + {@code demo.docusign.net}.<br>
 * Endpoints prod : {@code account.docusign.com} + {@code www.docusign.net}.<br>
 * Configures via les properties YAML.</p>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.docusign")
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignConfig {

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String authorizationUrl = "https://account-d.docusign.com/oauth/auth";
    private String tokenUrl          = "https://account-d.docusign.com/oauth/token";
    private String revokeUrl         = "https://account-d.docusign.com/oauth/revoke";
    private String userInfoUrl       = "https://account-d.docusign.com/oauth/userinfo";
    /**
     * Base URL des APIs eSignature (variable selon le compte — recuperee
     * dynamiquement via /oauth/userinfo apres connexion). Defaut sandbox.
     */
    private String apiBaseUrl = "https://demo.docusign.net/restapi";
    /**
     * Scopes Authorization Code Grant. {@code signature} = creation d'enveloppes.
     * {@code impersonation} reserve au JWT Grant (pas utilise ici).
     */
    private String scopes = "signature";

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

    public String getUserInfoUrl() { return userInfoUrl; }
    public void setUserInfoUrl(String userInfoUrl) { this.userInfoUrl = userInfoUrl; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public String getScopes() { return scopes; }
    public void setScopes(String scopes) { this.scopes = scopes; }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }
}
