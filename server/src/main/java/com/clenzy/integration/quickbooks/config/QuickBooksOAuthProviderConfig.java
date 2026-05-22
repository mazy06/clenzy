package com.clenzy.integration.quickbooks.config;

import com.clenzy.integration.oauth.OAuthProviderConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptateur QuickBooks vers {@link OAuthProviderConfig} — meme pattern que
 * {@code DocuSignOAuthProviderConfig} et {@code PennylaneOAuthProviderConfig}.
 *
 * <p>QuickBooks exige HTTP Basic Auth sur {@code /oauth2/v1/tokens/bearer}
 * (RFC 6749 section 2.3.1). Le moteur OAuth applique automatiquement le
 * header {@code Authorization: Basic base64(clientId:clientSecret)}.</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.quickbooks.client-id")
public class QuickBooksOAuthProviderConfig implements OAuthProviderConfig {

    public static final String PROVIDER_KEY = "quickbooks";

    private final QuickBooksConfig delegate;

    public QuickBooksOAuthProviderConfig(QuickBooksConfig delegate) {
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
