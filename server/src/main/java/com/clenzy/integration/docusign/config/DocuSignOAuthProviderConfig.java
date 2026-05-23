package com.clenzy.integration.docusign.config;

import com.clenzy.integration.oauth.OAuthProviderConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptateur DocuSign vers {@link OAuthProviderConfig} — meme pattern que
 * {@code PennylaneOAuthProviderConfig}.
 *
 * <h2>useHttpBasicAuth = true</h2>
 * <p>DocuSign exige l'authentification client via HTTP Basic Auth sur l'endpoint
 * {@code /oauth/token} (RFC 6749 section 2.3.1, methode preferee). Le moteur
 * OAuth applique automatiquement le header
 * {@code Authorization: Basic base64(clientId:clientSecret)}.</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignOAuthProviderConfig implements OAuthProviderConfig {

    public static final String PROVIDER_KEY = "docusign";

    private final DocuSignConfig delegate;

    public DocuSignOAuthProviderConfig(DocuSignConfig delegate) {
        this.delegate = delegate;
    }

    @Override public String getProviderKey()      { return PROVIDER_KEY; }
    @Override public String getClientId()         { return delegate.getClientId(); }
    @Override public String getClientSecret()     { return delegate.getClientSecret(); }
    @Override public String getRedirectUri()      { return delegate.getRedirectUri(); }
    @Override public String getAuthorizationUrl() { return delegate.getAuthorizationUrl(); }
    @Override public String getTokenUrl()         { return delegate.getTokenUrl(); }
    @Override public String getRevokeUrl()        { return delegate.getRevokeUrl(); }
    @Override public String getScopes()           { return delegate.getScopes(); }
    @Override public boolean useHttpBasicAuth()   { return true; }
}
