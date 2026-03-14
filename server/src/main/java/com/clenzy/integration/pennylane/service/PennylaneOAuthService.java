package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import com.clenzy.repository.IntegrationPartnerRepository;
import com.clenzy.service.TokenEncryptionService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service OAuth2 pour l'integration comptable Pennylane.
 *
 * Suit le pattern AirbnbOAuthService / MinutOAuthService :
 * - State CSRF en Redis (UUID aleatoire, TTL 10 min)
 * - Tokens chiffres via TokenEncryptionService (AES-256-GCM)
 * - Circuit breaker sur les appels HTTP
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneOAuthService {

    private static final Logger log = LoggerFactory.getLogger(PennylaneOAuthService.class);

    private static final String OAUTH_STATE_PREFIX = "oauth:pennylane:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);
    private static final long REFRESH_MARGIN_SECONDS = 300; // 5 minutes
    private static final long REFRESH_TOKEN_VALIDITY_DAYS = 90;

    private final PennylaneConfig config;
    private final PennylaneConnectionRepository connectionRepository;
    private final IntegrationPartnerRepository partnerRepository;
    private final TokenEncryptionService encryptionService;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    public PennylaneOAuthService(PennylaneConfig config,
                                  PennylaneConnectionRepository connectionRepository,
                                  IntegrationPartnerRepository partnerRepository,
                                  TokenEncryptionService encryptionService,
                                  StringRedisTemplate redisTemplate) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.partnerRepository = partnerRepository;
        this.encryptionService = encryptionService;
        this.redisTemplate = redisTemplate;
        this.restTemplate = new RestTemplate();
    }

    // ─── OAuth Flow ──────────────────────────────────────────────────────────

    /**
     * Genere l'URL d'autorisation OAuth2 Pennylane avec un state CSRF aleatoire.
     */
    public String getAuthorizationUrl(Long userId, Long orgId) {
        String state = UUID.randomUUID().toString();
        String stateValue = userId + ":" + orgId;
        redisTemplate.opsForValue().set(OAUTH_STATE_PREFIX + state, stateValue, OAUTH_STATE_TTL);

        return config.getAuthorizationUrl()
            + "?client_id=" + config.getClientId()
            + "&redirect_uri=" + config.getRedirectUri()
            + "&response_type=code"
            + "&scope=" + config.getScopes().replace(" ", "%20")
            + "&state=" + state;
    }

    /**
     * Valide et consomme le state OAuth (single-use, CSRF protection).
     *
     * @return Map avec userId et orgId, ou empty si state invalide/expire
     */
    public Optional<Map<String, Long>> validateAndConsumeState(String state) {
        String key = OAUTH_STATE_PREFIX + state;
        String value = redisTemplate.opsForValue().get(key);

        if (value == null) {
            log.warn("Pennylane OAuth — state invalide ou expire: {}", state);
            return Optional.empty();
        }

        // Single-use : supprimer immediatement
        redisTemplate.delete(key);

        String[] parts = value.split(":");
        if (parts.length != 2) {
            log.error("Pennylane OAuth — format state invalide: {}", value);
            return Optional.empty();
        }

        return Optional.of(Map.of(
            "userId", Long.parseLong(parts[0]),
            "orgId", Long.parseLong(parts[1])
        ));
    }

    /**
     * Echange le code d'autorisation contre des tokens OAuth2.
     */
    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "exchangeCodeFallback")
    public PennylaneConnection exchangeCodeForToken(String code, Long userId, Long orgId) {
        log.info("Pennylane OAuth — echange code pour tokens, org={}", orgId);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", config.getClientId());
        body.add("client_secret", config.getClientSecret());
        body.add("code", code);
        body.add("redirect_uri", config.getRedirectUri());
        body.add("grant_type", "authorization_code");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.exchange(
            config.getTokenUrl(),
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            Map.class
        ).getBody();

        if (response == null) {
            throw new RuntimeException("Pennylane OAuth — reponse vide lors de l'echange de code");
        }

        String accessToken = (String) response.get("access_token");
        String refreshToken = (String) response.get("refresh_token");
        Number expiresIn = (Number) response.get("expires_in");

        // Chiffrer les tokens avant stockage
        String accessTokenEncrypted = encryptionService.encrypt(accessToken);
        String refreshTokenEncrypted = refreshToken != null ? encryptionService.encrypt(refreshToken) : null;

        Instant now = Instant.now();
        long expiresInSeconds = expiresIn != null ? expiresIn.longValue() : 86400L; // 24h par defaut

        // Creer ou mettre a jour la connexion
        PennylaneConnection connection = connectionRepository
            .findByOrganizationId(orgId)
            .orElseGet(PennylaneConnection::new);

        connection.setOrganizationId(orgId);
        connection.setUserId(userId);
        connection.setAccessTokenEncrypted(accessTokenEncrypted);
        connection.setRefreshTokenEncrypted(refreshTokenEncrypted);
        connection.setTokenExpiresAt(now.plusSeconds(expiresInSeconds));
        connection.setRefreshTokenExpiresAt(now.plus(Duration.ofDays(REFRESH_TOKEN_VALIDITY_DAYS)));
        connection.setScopes(config.getScopes());
        connection.setStatus(PennylaneConnection.Status.ACTIVE);
        connection.setErrorMessage(null);
        if (connection.getConnectedAt() == null) {
            connection.setConnectedAt(now);
        }

        PennylaneConnection saved = connectionRepository.save(connection);

        // Mettre a jour le statut IntegrationPartner
        updatePartnerStatus(orgId, IntegrationStatus.CONNECTED);

        log.info("Pennylane OAuth — connexion reussie pour org={}", orgId);
        return saved;
    }

    /**
     * Rafraichit le token d'acces via le refresh token.
     * Le refresh token Pennylane est single-use (un nouveau est fourni a chaque refresh).
     */
    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "refreshTokenFallback")
    public PennylaneConnection refreshToken(Long orgId) {
        PennylaneConnection connection = connectionRepository
            .findByOrganizationIdAndStatus(orgId, PennylaneConnection.Status.ACTIVE)
            .orElseThrow(() -> new IllegalStateException("Pas de connexion Pennylane active pour org=" + orgId));

        String refreshToken = encryptionService.decrypt(connection.getRefreshTokenEncrypted());

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", config.getClientId());
        body.add("client_secret", config.getClientSecret());
        body.add("refresh_token", refreshToken);
        body.add("grant_type", "refresh_token");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.exchange(
            config.getTokenUrl(),
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            Map.class
        ).getBody();

        if (response == null) {
            throw new RuntimeException("Pennylane OAuth — reponse vide lors du refresh");
        }

        String newAccessToken = (String) response.get("access_token");
        String newRefreshToken = (String) response.get("refresh_token");
        Number expiresIn = (Number) response.get("expires_in");

        Instant now = Instant.now();
        long expiresInSeconds = expiresIn != null ? expiresIn.longValue() : 86400L;

        connection.setAccessTokenEncrypted(encryptionService.encrypt(newAccessToken));
        if (newRefreshToken != null) {
            connection.setRefreshTokenEncrypted(encryptionService.encrypt(newRefreshToken));
            connection.setRefreshTokenExpiresAt(now.plus(Duration.ofDays(REFRESH_TOKEN_VALIDITY_DAYS)));
        }
        connection.setTokenExpiresAt(now.plusSeconds(expiresInSeconds));
        connection.setStatus(PennylaneConnection.Status.ACTIVE);
        connection.setErrorMessage(null);

        log.info("Pennylane OAuth — token rafraichi pour org={}", orgId);
        return connectionRepository.save(connection);
    }

    /**
     * Revoque le token et deconnecte l'organisation de Pennylane.
     */
    public void revokeToken(Long orgId) {
        PennylaneConnection connection = connectionRepository
            .findByOrganizationId(orgId)
            .orElseThrow(() -> new IllegalStateException("Pas de connexion Pennylane pour org=" + orgId));

        // Appel de revocation (best effort, on deconnecte meme si ca echoue)
        try {
            String accessToken = encryptionService.decrypt(connection.getAccessTokenEncrypted());

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("client_id", config.getClientId());
            body.add("client_secret", config.getClientSecret());
            body.add("token", accessToken);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            restTemplate.exchange(
                config.getRevokeUrl(),
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Void.class
            );
            log.info("Pennylane OAuth — token revoque pour org={}", orgId);
        } catch (Exception e) {
            log.warn("Pennylane OAuth — erreur lors de la revocation (non bloquant): {}", e.getMessage());
        }

        connection.setStatus(PennylaneConnection.Status.REVOKED);
        connection.setAccessTokenEncrypted(null);
        connection.setRefreshTokenEncrypted(null);
        connectionRepository.save(connection);

        updatePartnerStatus(orgId, IntegrationStatus.DISCONNECTED);
    }

    /**
     * Retourne un access token valide, en rafraichissant si necessaire.
     */
    public String getValidAccessToken(Long orgId) {
        PennylaneConnection connection = connectionRepository
            .findByOrganizationIdAndStatus(orgId, PennylaneConnection.Status.ACTIVE)
            .orElseThrow(() -> new IllegalStateException("Pas de connexion Pennylane active pour org=" + orgId));

        if (connection.isTokenExpiringSoon()) {
            log.debug("Pennylane OAuth — token bientot expire, refresh pour org={}", orgId);
            connection = refreshToken(orgId);
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    /**
     * Verifie si une organisation est connectee a Pennylane.
     */
    public boolean isConnected(Long orgId) {
        return connectionRepository
            .findByOrganizationIdAndStatus(orgId, PennylaneConnection.Status.ACTIVE)
            .isPresent();
    }

    /**
     * Retourne la connexion active pour une organisation.
     */
    public Optional<PennylaneConnection> getConnection(Long orgId) {
        return connectionRepository.findByOrganizationId(orgId);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

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

    // ─── Fallbacks ───────────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private PennylaneConnection exchangeCodeFallback(String code, Long userId, Long orgId, Throwable t) {
        log.error("Pennylane OAuth — circuit breaker ouvert lors de l'echange de code: {}", t.getMessage());
        throw new RuntimeException("Service Pennylane temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private PennylaneConnection refreshTokenFallback(Long orgId, Throwable t) {
        log.error("Pennylane OAuth — circuit breaker ouvert lors du refresh: {}", t.getMessage());

        // Marquer la connexion en erreur
        connectionRepository.findByOrganizationId(orgId).ifPresent(conn -> {
            conn.setStatus(PennylaneConnection.Status.ERROR);
            conn.setErrorMessage("Refresh token echoue: " + t.getMessage());
            connectionRepository.save(conn);
        });

        throw new RuntimeException("Service Pennylane temporairement indisponible", t);
    }
}
