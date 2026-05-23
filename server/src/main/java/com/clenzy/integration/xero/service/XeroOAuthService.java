package com.clenzy.integration.xero.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.xero.config.XeroOAuthProviderConfig;
import com.clenzy.integration.xero.model.XeroConnection;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service OAuth2 Xero — facade fine sur {@link OAuthFlowEngine}. Le hook
 * post-callback {@link #saveTenant(Long, String, String)} permet de stocker
 * le tenant Xero selectionne (apres appel a GET /connections cote
 * controller / API client futur).
 */
@Service
@ConditionalOnProperty(name = "clenzy.xero.client-id")
public class XeroOAuthService {

    private static final Logger log = LoggerFactory.getLogger(XeroOAuthService.class);

    private final OAuthFlowEngine flowEngine;
    private final OAuthStateService stateService;
    private final XeroOAuthProviderConfig providerConfig;
    private final XeroConnectionPersistence persistence;

    public XeroOAuthService(OAuthFlowEngine flowEngine,
                              OAuthStateService stateService,
                              XeroOAuthProviderConfig providerConfig,
                              XeroConnectionPersistence persistence) {
        this.flowEngine = flowEngine;
        this.stateService = stateService;
        this.providerConfig = providerConfig;
        this.persistence = persistence;
    }

    public String getAuthorizationUrl(Long userId, Long orgId) {
        return flowEngine.buildAuthorizationUrl(providerConfig, userId, orgId);
    }

    public Optional<OAuthStateService.StatePayload> validateAndConsumeState(String state) {
        return stateService.validateAndConsume(XeroOAuthProviderConfig.PROVIDER_KEY, state);
    }

    @CircuitBreaker(name = "xero-api", fallbackMethod = "exchangeCodeFallback")
    public XeroConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        return flowEngine.exchangeCodeForToken(providerConfig, persistence, code, userId, orgId);
    }

    /** Persiste le tenant Xero choisi par l'utilisateur (apres GET /connections). */
    public void saveTenant(Long orgId, String tenantId, String tenantName) {
        persistence.findByOrganizationId(orgId).ifPresent(conn -> {
            conn.setTenantId(tenantId);
            conn.setTenantName(tenantName);
            persistence.save(conn);
        });
    }

    @CircuitBreaker(name = "xero-api", fallbackMethod = "refreshTokenFallback")
    public XeroConnection refreshToken(Long orgId) {
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

    public Optional<XeroConnection> getConnection(Long orgId) {
        return persistence.findByOrganizationId(orgId);
    }

    @SuppressWarnings("unused")
    private XeroConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("Xero OAuth — circuit breaker ouvert sur exchange: {}", t.getMessage());
        throw new RuntimeException("Service Xero temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private XeroConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("Xero OAuth — circuit breaker ouvert sur refresh: {}", t.getMessage());
        throw new RuntimeException("Service Xero temporairement indisponible", t);
    }
}
