package com.clenzy.integration.xero.config;

import com.clenzy.integration.oauth.OAuthProviderConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptateur Xero vers {@link OAuthProviderConfig}.
 *
 * <p>Xero exige HTTP Basic Auth sur {@code /connect/token}. Le moteur OAuth
 * applique automatiquement le header
 * {@code Authorization: Basic base64(clientId:clientSecret)}.</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.xero.client-id")
public class XeroOAuthProviderConfig implements OAuthProviderConfig {

    public static final String PROVIDER_KEY = "xero";

    private final XeroConfig delegate;

    public XeroOAuthProviderConfig(XeroConfig delegate) {
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
