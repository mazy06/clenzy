package com.clenzy.integration.pennylane.config;

import com.clenzy.integration.oauth.OAuthProviderConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptateur Pennylane vers le contrat {@link OAuthProviderConfig}.
 *
 * <p>Delegue a {@link PennylaneConfig} qui contient le binding YAML existant
 * (prefix {@code clenzy.pennylane.*}). Permet a {@code OAuthFlowEngine} de
 * consommer la config Pennylane sans connaitre PennylaneConfig directement
 * (Dependency Inversion Principle).</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneOAuthProviderConfig implements OAuthProviderConfig {

    public static final String PROVIDER_KEY = "pennylane";

    private final PennylaneConfig delegate;

    public PennylaneOAuthProviderConfig(PennylaneConfig delegate) {
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
