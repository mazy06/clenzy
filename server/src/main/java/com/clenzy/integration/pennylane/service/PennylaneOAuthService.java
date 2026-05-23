package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.pennylane.config.PennylaneOAuthProviderConfig;
import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import com.clenzy.repository.IntegrationPartnerRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Service OAuth2 Pennylane — facade fine qui delegue le flow OAuth au
 * {@link OAuthFlowEngine} partage et conserve la logique Pennylane-specifique
 * (mise a jour du statut IntegrationPartner, circuit breaker).
 *
 * <h2>Avant / Apres la mutualisation</h2>
 * <p>Avant : ~340 lignes (build URL, exchange code, refresh, revoke, state Redis,
 * etc.). Apres : ~120 lignes — le flow OAuth vit dans {@link OAuthFlowEngine}.
 * Ajouter un nouveau provider OAuth (DocuSign, etc.) ne dupique plus 200+
 * lignes (Don't Repeat Yourself).</p>
 *
 * <h2>API publique preservee</h2>
 * Les methodes appellees par {@code PennylaneOAuthController} et
 * {@code PennylaneAccountingClient} gardent la meme signature — aucun
 * changement requis pour les appelants.
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneOAuthService {

    private static final Logger log = LoggerFactory.getLogger(PennylaneOAuthService.class);

    private final OAuthFlowEngine flowEngine;
    private final OAuthStateService stateService;
    private final PennylaneOAuthProviderConfig providerConfig;
    private final PennylaneConnectionPersistence persistence;
    private final IntegrationPartnerRepository partnerRepository;

    public PennylaneOAuthService(OAuthFlowEngine flowEngine,
                                  OAuthStateService stateService,
                                  PennylaneOAuthProviderConfig providerConfig,
                                  PennylaneConnectionPersistence persistence,
                                  IntegrationPartnerRepository partnerRepository) {
        this.flowEngine = flowEngine;
        this.stateService = stateService;
        this.providerConfig = providerConfig;
        this.persistence = persistence;
        this.partnerRepository = partnerRepository;
    }

    // ─── Flow OAuth (delegue au moteur partage) ──────────────────────────────

    public String getAuthorizationUrl(Long userId, Long orgId) {
        return flowEngine.buildAuthorizationUrl(providerConfig, userId, orgId);
    }

    /**
     * Valide et consomme le state. Garde la signature historique
     * (Map&lt;String, Long&gt;) pour ne pas casser PennylaneOAuthController.
     */
    public Optional<Map<String, Long>> validateAndConsumeState(String state) {
        return stateService.validateAndConsume(PennylaneOAuthProviderConfig.PROVIDER_KEY, state)
            .map(payload -> Map.of("userId", payload.userId(), "orgId", payload.orgId()));
    }

    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "exchangeCodeFallback")
    public PennylaneConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        PennylaneConnection saved = flowEngine.exchangeCodeForToken(
            providerConfig, persistence, code, userId, orgId);
        updatePartnerStatus(orgId, IntegrationStatus.CONNECTED);
        return saved;
    }

    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "refreshTokenFallback")
    public PennylaneConnection refreshToken(Long orgId) {
        return flowEngine.refreshToken(providerConfig, persistence, orgId);
    }

    public void revokeToken(Long orgId) {
        flowEngine.revokeToken(providerConfig, persistence, orgId);
        updatePartnerStatus(orgId, IntegrationStatus.DISCONNECTED);
    }

    public String getValidAccessToken(Long orgId) {
        return flowEngine.getValidAccessToken(providerConfig, persistence, orgId);
    }

    // ─── Queries Pennylane-specific ──────────────────────────────────────────

    public boolean isConnected(Long orgId) {
        return persistence.findActiveByOrganizationId(orgId).isPresent();
    }

    public Optional<PennylaneConnection> getConnection(Long orgId) {
        return persistence.findByOrganizationId(orgId);
    }

    // ─── IntegrationPartner status sync (Pennylane-specific) ────────────────

    private void updatePartnerStatus(Long orgId, IntegrationStatus status) {
        partnerRepository.findBySlugAndOrgId("pennylane", orgId)
            .ifPresent(partner -> {
                partner.setStatus(status);
                if (status == IntegrationStatus.CONNECTED) {
                    partner.setConnectedAt(Instant.now());
                }
                partnerRepository.save(partner);
            });
    }

    // ─── Circuit breaker fallbacks ───────────────────────────────────────────

    @SuppressWarnings("unused")
    private PennylaneConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("Pennylane OAuth — circuit breaker ouvert sur exchange: {}", t.getMessage());
        throw new RuntimeException("Service Pennylane temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private PennylaneConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("Pennylane OAuth — circuit breaker ouvert sur refresh: {}", t.getMessage());
        throw new RuntimeException("Service Pennylane temporairement indisponible", t);
    }
}
