package com.clenzy.integration.sage.config;

import com.clenzy.integration.oauth.OAuthProviderConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptateur Sage vers {@link OAuthProviderConfig}.
 *
 * <p>Sage accepte les credentials dans le body www-form (pas Basic Auth) — le
 * moteur OAuth bascule donc en mode par defaut quand useHttpBasicAuth = false.</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.sage.client-id")
public class SageOAuthProviderConfig implements OAuthProviderConfig {

    public static final String PROVIDER_KEY = "sage";

    private final SageConfig delegate;

    public SageOAuthProviderConfig(SageConfig delegate) {
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
}
