package com.clenzy.integration.homeaway.service;

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

    public HomeAwayOAuthService(HomeAwayConfig config,
                                HomeAwayConnectionRepository connectionRepository,
                                AirbnbTokenEncryptionService encryptionService,
                                AuditLogService auditLogService,
                                StringRedisTemplate redisTemplate,
                                RestTemplate restTemplate) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.auditLogService = auditLogService;
        this.redisTemplate = redisTemplate;
        this.restTemplate = restTemplate;
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
     * Supprime le state de Redis apres validation (usage unique).
     */
    public Long validateAndConsumeState(String state) {
        String key = OAUTH_STATE_PREFIX + state;
        String orgIdStr = redisTemplate.opsForValue().get(key);
        if (orgIdStr == null) {
            throw new SecurityException("Invalid or expired OAuth state parameter");
        }
        redisTemplate.delete(key);
        return Long.parseLong(orgIdStr);
    }

    /**
     * Echange le code d'autorisation contre un access token.
     * Stocke les tokens chiffres en base.
     */
    @CircuitBreaker(name = "homeaway-oauth")
    public HomeAwayConnection exchangeCodeForToken(String code, Long orgId) {
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

                String accessToken = (String) tokenData.get("access_token");
                String refreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = (Integer) tokenData.get("expires_in");

                // Creer ou mettre a jour la connexion
                HomeAwayConnection connection = connectionRepository.findByOrganizationId(orgId)
                        .orElse(new HomeAwayConnection());

                connection.setOrganizationId(orgId);
                connection.setAccessTokenEncrypted(encryptionService.encrypt(accessToken));
                if (refreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptionService.encrypt(refreshToken));
                }
                connection.setTokenExpiresAt(
                        expiresIn != null ? LocalDateTime.now().plusSeconds(expiresIn) : null);
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
            log.error("Erreur lors de l'echange du code OAuth HomeAway: {}", e.getMessage());

            connectionRepository.findByOrganizationId(orgId).ifPresent(conn -> {
                conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
                conn.setErrorMessage(e.getMessage());
                connectionRepository.save(conn);
            });

            throw new RuntimeException("Echec de l'echange OAuth HomeAway", e);
        }
    }

    /**
     * Rafraichit le token d'acces avant expiration.
     */
    @CircuitBreaker(name = "homeaway-oauth")
    public HomeAwayConnection refreshToken(Long orgId) {
        log.info("Rafraichissement du token HomeAway pour org: {}", orgId);

        HomeAwayConnection connection = connectionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion HomeAway pour org: " + orgId));

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

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(), new HttpEntity<>(params, headers), Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                String newAccessToken = (String) tokenData.get("access_token");
                String newRefreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = (Integer) tokenData.get("expires_in");

                connection.setAccessTokenEncrypted(encryptionService.encrypt(newAccessToken));
                if (newRefreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptionService.encrypt(newRefreshToken));
                }
                connection.setTokenExpiresAt(
                        expiresIn != null ? LocalDateTime.now().plusSeconds(expiresIn) : null);
                connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);

            } else {
                throw new RuntimeException("Echec du refresh: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Erreur lors du refresh du token HomeAway: {}", e.getMessage());
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.EXPIRED);
            connection.setErrorMessage("Refresh echoue: " + e.getMessage());
            connectionRepository.save(connection);
            throw new RuntimeException("Echec du rafraichissement du token HomeAway", e);
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
            connection = refreshToken(orgId);
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
