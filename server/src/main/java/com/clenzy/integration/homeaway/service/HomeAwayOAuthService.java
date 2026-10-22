package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.oauth.BaitlyOAuthDiagnostics;
import com.clenzy.integration.oauth.BaitlyOAuthConnectionGuard;
import static com.clenzy.integration.oauth.BaitlyOAuthDiagnostics.Operation.*;

import com.clenzy.integration.oauth.BaitlyOAuthTokenResponse;
import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.service.AuditLogService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service OAuth 2.0 pour l'integration HomeAway/Abritel.
 *
 * Gere le cycle de vie complet des tokens :
 * - Generation de l'URL d'autorisation
 * - Echange du code d'autorisation contre un access token
 * - Rafraichissement automatique des tokens
 * - Revocation des tokens
 *
 * Suit le meme pattern que {@link com.clenzy.integration.airbnb.service.AirbnbOAuthService}.
 */
@Service
public class HomeAwayOAuthService {

    private static final Logger log = LoggerFactory.getLogger(HomeAwayOAuthService.class);

    private static final String OAUTH_STATE_PREFIX = "oauth:homeaway:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);

    private final HomeAwayConfig config;
    private final HomeAwayConnectionRepository connectionRepository;
    private final AirbnbTokenEncryptionService encryptionService;
    private final AuditLogService auditLogService;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;
    private final BaitlyOAuthConnectionGuard connectionGuard;

    public HomeAwayOAuthService(HomeAwayConfig config,
                                HomeAwayConnectionRepository connectionRepository,
                                AirbnbTokenEncryptionService encryptionService,
                                AuditLogService auditLogService,
                                StringRedisTemplate redisTemplate,
                                RestTemplate restTemplate, BaitlyOAuthConnectionGuard connectionGuard) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.auditLogService = auditLogService;
        this.redisTemplate = redisTemplate;
        this.restTemplate = restTemplate;
        this.connectionGuard = connectionGuard;
    }

    /**
     * Genere l'URL de redirection vers HomeAway pour l'autorisation OAuth.
     * Utilise un state CSRF aleatoire stocke en Redis (TTL 10 min).
     */
    public String getAuthorizationUrl(Long orgId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("Configuration HomeAway incomplete. Verifiez les variables d'environnement.");
        }

        // Generer un state CSRF aleatoire et stocker le mapping state->orgId dans Redis
        String state = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(OAUTH_STATE_PREFIX + state, orgId.toString(), OAUTH_STATE_TTL);

        return config.getAuthorizationUrl()
                + "?client_id=" + config.getClientId()
                + "&redirect_uri=" + config.getRedirectUri()
                + "&state=" + state
                + "&response_type=code";
    }

    /**
     * Valide le state OAuth et retourne l'orgId associe.
     * Consomme atomiquement le state Redis (usage unique).
     */
    public Long validateAndConsumeState(String state) {
        if (state == null || state.isBlank()) throw new SecurityException("Invalid or expired OAuth state parameter");
        String key = OAUTH_STATE_PREFIX + state;
        String orgIdStr = redisTemplate.opsForValue().getAndDelete(key);
        if (orgIdStr == null) {
            throw new SecurityException("Invalid or expired OAuth state parameter");
        }
        return Long.parseLong(orgIdStr);
    }

    /**
     * Echange le code d'autorisation contre un access token.
     * Stocke les tokens chiffres en base.
     */
    @CircuitBreaker(name = "homeaway-oauth")
    public HomeAwayConnection exchangeCodeForToken(String code, Long orgId) {
        return connectionGuard.executeRefresh("homeaway", orgId,
                () -> exchangeUnderLock(code, orgId));
    }

    private HomeAwayConnection exchangeUnderLock(String code, Long orgId) {
        log.info("Echange du code OAuth HomeAway pour org: {}", orgId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", config.getClientId());
        params.add("client_secret", config.getClientSecret());
        params.add("code", code);
        params.add("redirect_uri", config.getRedirectUri());
        params.add("grant_type", "authorization_code");

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(), new HttpEntity<>(params, headers), Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                var tokens = BaitlyOAuthTokenResponse.parse(tokenData, null);
                String accessToken = tokens.accessToken();
                String refreshToken = tokens.refreshToken();
                Integer expiresIn = tokens.expiresIn();

                // Creer ou mettre a jour la connexion
                HomeAwayConnection connection = connectionRepository.findByOrganizationId(orgId)
                        .orElse(new HomeAwayConnection());

                // Préparer tous les secrets et dates avant de modifier la connexion Baitly.
                String encryptedAccess = encryptionService.encrypt(accessToken);
                String encryptedRefresh = refreshToken != null ? encryptionService.encrypt(refreshToken) : null;
                LocalDateTime tokenExpiresAt = expiresIn != null ? LocalDateTime.now().plusSeconds(expiresIn) : null;

                connection.setOrganizationId(orgId);
                connection.setAccessTokenEncrypted(encryptedAccess);
                if (refreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptedRefresh);
                }
                connection.setTokenExpiresAt(tokenExpiresAt);
                connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                HomeAwayConnection saved = connectionRepository.save(connection);

                auditLogService.logSync("HomeAwayConnection", saved.getId().toString(),
                        "Connexion OAuth HomeAway etablie pour org " + orgId);

                log.info("Connexion HomeAway etablie pour org: {}", orgId);
                return saved;

            } else {
                throw new RuntimeException("Reponse non-2xx de HomeAway: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Échec OAuth homeaway", BaitlyOAuthDiagnostics.failure(EXCHANGE, e));

            connectionRepository.findByOrganizationId(orgId).ifPresent(conn -> {
                conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
                conn.setErrorMessage(BaitlyOAuthDiagnostics.message(EXCHANGE));
                connectionRepository.save(conn);
            });

            throw BaitlyOAuthDiagnostics.failure(EXCHANGE, e);
        }
    }

    /**
     * Rafraichit le token d'acces avant expiration.
     */
    @CircuitBreaker(name = "homeaway-oauth")
    public HomeAwayConnection refreshToken(Long orgId) {
        return connectionGuard.executeRefresh("homeaway", orgId,
                () -> refreshUnderLock(orgId, false));
    }

    private HomeAwayConnection refreshUnderLock(Long orgId, boolean onlyIfExpiring) {
        log.info("Rafraichissement du token HomeAway pour org: {}", orgId);

        HomeAwayConnection connection = connectionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion HomeAway pour org: " + orgId));

        if (!connection.isActive()) throw new IllegalStateException("Connexion OAuth inactive ; reconnexion requise");
        if (onlyIfExpiring && (connection.getTokenExpiresAt() == null
                || !connection.getTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5)))) return connection;

        try {
            String refreshToken = encryptionService.decrypt(connection.getRefreshTokenEncrypted());
            if (refreshToken == null) {
                throw new RuntimeException("Pas de refresh token disponible");
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", config.getClientId());
            params.add("client_secret", config.getClientSecret());
            params.add("refresh_token", refreshToken);
            params.add("grant_type", "refresh_token");

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(), new HttpEntity<>(params, headers), Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                var tokens = BaitlyOAuthTokenResponse.parse(tokenData, null);
                String newAccessToken = tokens.accessToken();
                String newRefreshToken = tokens.refreshToken();
                Integer expiresIn = tokens.expiresIn();

                // Préparer tous les secrets et dates avant de modifier la connexion Baitly.
                String encryptedAccess = encryptionService.encrypt(newAccessToken);
                String encryptedRefresh = newRefreshToken != null ? encryptionService.encrypt(newRefreshToken) : null;
                LocalDateTime tokenExpiresAt = expiresIn != null ? LocalDateTime.now().plusSeconds(expiresIn) : null;

                connection.setAccessTokenEncrypted(encryptedAccess);
                if (newRefreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptedRefresh);
                }
                connection.setTokenExpiresAt(tokenExpiresAt);
                connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);

            } else {
                throw new RuntimeException("Echec du refresh: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Échec OAuth homeaway", BaitlyOAuthDiagnostics.failure(REFRESH, e));
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.EXPIRED);
            connection.setErrorMessage(BaitlyOAuthDiagnostics.message(REFRESH));
            connectionRepository.save(connection);
            throw BaitlyOAuthDiagnostics.failure(REFRESH, e);
        }
    }

    /**
     * Retourne un token valide (refresh automatique si necessaire).
     */
    public String getValidAccessToken(Long orgId) {
        HomeAwayConnection connection = connectionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion HomeAway pour org: " + orgId));

        if (connection.getStatus() != HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE) {
            throw new RuntimeException("Connexion HomeAway non active (statut: " + connection.getStatus() + ")");
        }

        // Verifier si le token est proche de l'expiration (5 min de marge)
        if (connection.getTokenExpiresAt() != null
                && connection.getTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            log.info("Token HomeAway proche de l'expiration, rafraichissement...");
            connection = connectionGuard.executeRefresh("homeaway", orgId,
                    () -> refreshUnderLock(orgId, true));
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    /**
     * Retourne le statut de la connexion HomeAway pour une organisation.
     */
    public Optional<HomeAwayConnection> getConnectionStatus(Long orgId) {
        return connectionRepository.findByOrganizationId(orgId);
    }

    /**
     * Verifie si une organisation a une connexion HomeAway active.
     */
    public boolean isConnected(Long orgId) {
        return connectionRepository.findByOrganizationId(orgId)
                .map(HomeAwayConnection::isActive)
                .orElse(false);
    }
}
