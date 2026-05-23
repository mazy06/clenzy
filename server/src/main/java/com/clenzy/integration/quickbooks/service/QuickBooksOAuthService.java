package com.clenzy.integration.quickbooks.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.quickbooks.config.QuickBooksOAuthProviderConfig;
import com.clenzy.integration.quickbooks.model.QuickBooksConnection;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service OAuth2 QuickBooks Online — facade fine sur {@link OAuthFlowEngine}.
 *
 * <p>Le post-traitement specifique (sauvegarde du realmId recu en parametre
 * du callback) est applique apres l'echange de code via
 * {@link #saveRealmId(Long, String)}.</p>
 */
@Service
@ConditionalOnProperty(name = "clenzy.quickbooks.client-id")
public class QuickBooksOAuthService {

    private static final Logger log = LoggerFactory.getLogger(QuickBooksOAuthService.class);

    private final OAuthFlowEngine flowEngine;
    private final OAuthStateService stateService;
    private final QuickBooksOAuthProviderConfig providerConfig;
    private final QuickBooksConnectionPersistence persistence;

    public QuickBooksOAuthService(OAuthFlowEngine flowEngine,
                                    OAuthStateService stateService,
                                    QuickBooksOAuthProviderConfig providerConfig,
                                    QuickBooksConnectionPersistence persistence) {
        this.flowEngine = flowEngine;
        this.stateService = stateService;
        this.providerConfig = providerConfig;
        this.persistence = persistence;
    }

    public String getAuthorizationUrl(Long userId, Long orgId) {
        return flowEngine.buildAuthorizationUrl(providerConfig, userId, orgId);
    }

    public Optional<OAuthStateService.StatePayload> validateAndConsumeState(String state) {
        return stateService.validateAndConsume(QuickBooksOAuthProviderConfig.PROVIDER_KEY, state);
    }

    @CircuitBreaker(name = "quickbooks-api", fallbackMethod = "exchangeCodeFallback")
    public QuickBooksConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        return flowEngine.exchangeCodeForToken(providerConfig, persistence, code, userId, orgId);
    }

    /**
     * Persiste le realmId QuickBooks recu dans le callback (parametre additionnel
     * specifique a Intuit, en plus du code et du state OAuth standard).
     */
    public void saveRealmId(Long orgId, String realmId) {
        persistence.findByOrganizationId(orgId).ifPresent(conn -> {
            conn.setRealmId(realmId);
            persistence.save(conn);
        });
    }

    @CircuitBreaker(name = "quickbooks-api", fallbackMethod = "refreshTokenFallback")
    public QuickBooksConnection refreshToken(Long orgId) {
        return flowEngine.refreshToken(providerConfig, persistence, orgId);
    }

    public void revokeToken(Long orgId) {
        flowEngine.revokeToken(providerConfig, persistence, orgId);
    }

    public String getValidAccessToken(Long orgId) {
        return flowEngine.getValidAccessToken(providerConfig, persistence, orgId);
    }

    public boolean isConnected(Long orgId) {
        return persistence.findActiveByOrganizationId(orgId).isPresent();
    }

    public Optional<QuickBooksConnection> getConnection(Long orgId) {
        return persistence.findByOrganizationId(orgId);
    }

    // ─── Fallbacks ───────────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private QuickBooksConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("QuickBooks OAuth — circuit breaker ouvert sur exchange: {}", t.getMessage());
        throw new RuntimeException("Service QuickBooks temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private QuickBooksConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("QuickBooks OAuth — circuit breaker ouvert sur refresh: {}", t.getMessage());
        throw new RuntimeException("Service QuickBooks temporairement indisponible", t);
    }
}
