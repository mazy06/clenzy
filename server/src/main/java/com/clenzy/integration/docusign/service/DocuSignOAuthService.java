package com.clenzy.integration.docusign.service;

import com.clenzy.integration.docusign.config.DocuSignOAuthProviderConfig;
import com.clenzy.integration.docusign.model.DocuSignConnection;
import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service OAuth2 DocuSign — facade fine sur {@link OAuthFlowEngine}, structuree
 * exactement comme {@code PennylaneOAuthService} (cf. principe DRY appres
 * mutualisation).
 *
 * <h2>Pourquoi ce service existe</h2>
 * <p>Bien que la logique OAuth soit deja dans le moteur partage, on garde une
 * facade par provider pour :</p>
 * <ul>
 *   <li>Etre la cible d'injection des controllers (un seul point d'entree par
 *       provider)</li>
 *   <li>Heberger les decorations resilience (circuit breaker DocuSign-specific)</li>
 *   <li>Permettre des hooks metier post-connexion (ex: recuperer accountId via
 *       userinfo — a cabler quand on aura un compte DocuSign developer)</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignOAuthService {

    private static final Logger log = LoggerFactory.getLogger(DocuSignOAuthService.class);

    private final OAuthFlowEngine flowEngine;
    private final OAuthStateService stateService;
    private final DocuSignOAuthProviderConfig providerConfig;
    private final DocuSignConnectionPersistence persistence;

    public DocuSignOAuthService(OAuthFlowEngine flowEngine,
                                  OAuthStateService stateService,
                                  DocuSignOAuthProviderConfig providerConfig,
                                  DocuSignConnectionPersistence persistence) {
        this.flowEngine = flowEngine;
        this.stateService = stateService;
        this.providerConfig = providerConfig;
        this.persistence = persistence;
    }

    public String getAuthorizationUrl(Long userId, Long orgId) {
        return flowEngine.buildAuthorizationUrl(providerConfig, userId, orgId);
    }

    public Optional<OAuthStateService.StatePayload> validateAndConsumeState(String state) {
        return stateService.validateAndConsume(DocuSignOAuthProviderConfig.PROVIDER_KEY, state);
    }

    @CircuitBreaker(name = "docusign-api", fallbackMethod = "exchangeCodeFallback")
    public DocuSignConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        return flowEngine.exchangeCodeForToken(providerConfig, persistence, code, userId, orgId);
        // TODO post-connexion : appeler /oauth/userinfo pour stocker accountId
        //      et accountBaseUri (cf. DocuSignConnection). Sera fait quand on
        //      aura un Integration Key DocuSign actif.
    }

    @CircuitBreaker(name = "docusign-api", fallbackMethod = "refreshTokenFallback")
    public DocuSignConnection refreshToken(Long orgId) {
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

    public Optional<DocuSignConnection> getConnection(Long orgId) {
        return persistence.findByOrganizationId(orgId);
    }

    // ─── Fallbacks ───────────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private DocuSignConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("DocuSign OAuth — circuit breaker ouvert sur exchange: {}", t.getMessage());
        throw new RuntimeException("Service DocuSign temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private DocuSignConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("DocuSign OAuth — circuit breaker ouvert sur refresh: {}", t.getMessage());
        throw new RuntimeException("Service DocuSign temporairement indisponible", t);
    }
}
