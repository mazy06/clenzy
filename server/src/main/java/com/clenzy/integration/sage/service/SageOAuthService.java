package com.clenzy.integration.sage.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.sage.config.SageOAuthProviderConfig;
import com.clenzy.integration.sage.model.SageConnection;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

/** Service OAuth2 Sage Business Cloud — facade fine sur {@link OAuthFlowEngine}. */
@Service
@ConditionalOnProperty(name = "clenzy.sage.client-id")
public class SageOAuthService {

    private static final Logger log = LoggerFactory.getLogger(SageOAuthService.class);

    private final OAuthFlowEngine flowEngine;
    private final OAuthStateService stateService;
    private final SageOAuthProviderConfig providerConfig;
    private final SageConnectionPersistence persistence;

    public SageOAuthService(OAuthFlowEngine flowEngine,
                              OAuthStateService stateService,
                              SageOAuthProviderConfig providerConfig,
                              SageConnectionPersistence persistence) {
        this.flowEngine = flowEngine;
        this.stateService = stateService;
        this.providerConfig = providerConfig;
        this.persistence = persistence;
    }

    public String getAuthorizationUrl(Long userId, Long orgId) {
        return flowEngine.buildAuthorizationUrl(providerConfig, userId, orgId);
    }

    public Optional<OAuthStateService.StatePayload> validateAndConsumeState(String state) {
        return stateService.validateAndConsume(SageOAuthProviderConfig.PROVIDER_KEY, state);
    }

    @CircuitBreaker(name = "sage-api", fallbackMethod = "exchangeCodeFallback")
    public SageConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        return flowEngine.exchangeCodeForToken(providerConfig, persistence, code, userId, orgId);
    }

    /** Persiste la business Sage choisie par l'utilisateur (apres GET /businesses). */
    public void saveBusiness(Long orgId, String businessId, String businessName) {
        persistence.findByOrganizationId(orgId).ifPresent(conn -> {
            conn.setBusinessId(businessId);
            conn.setBusinessName(businessName);
            persistence.save(conn);
        });
    }

    @CircuitBreaker(name = "sage-api", fallbackMethod = "refreshTokenFallback")
    public SageConnection refreshToken(Long orgId) {
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

    public Optional<SageConnection> getConnection(Long orgId) {
        return persistence.findByOrganizationId(orgId);
    }

    @SuppressWarnings("unused")
    private SageConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("Sage OAuth — circuit breaker ouvert sur exchange: {}", t.getMessage());
        throw new RuntimeException("Service Sage temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private SageConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("Sage OAuth — circuit breaker ouvert sur refresh: {}", t.getMessage());
        throw new RuntimeException("Service Sage temporairement indisponible", t);
    }
}
