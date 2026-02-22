package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service OAuth 2.0 pour l'integration Airbnb.
 *
 * Gere le cycle de vie complet des tokens :
 * - Generation de l'URL d'autorisation
 * - Echange du code d'autorisation contre un access token
 * - Rafraichissement automatique des tokens
 * - Revocation des tokens
 */
@Service
public class AirbnbOAuthService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbOAuthService.class);

    private static final String OAUTH_STATE_PREFIX = "oauth:airbnb:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);

    private final AirbnbConfig config;
    private final AirbnbConnectionRepository connectionRepository;
    private final AirbnbTokenEncryptionService encryptionService;
    private final AuditLogService auditLogService;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    public AirbnbOAuthService(AirbnbConfig config,
                              AirbnbConnectionRepository connectionRepository,
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
     * Genere l'URL de redirection vers Airbnb pour l'autorisation OAuth.
     * Utilise un state CSRF aleatoire stocke en Redis (TTL 10 min).
     */
    public String getAuthorizationUrl(String userId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("Configuration Airbnb incomplete. Verifiez les variables d'environnement.");
        }

        // Generer un state CSRF aleatoire et stocker le mapping state->userId dans Redis
        String state = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(OAUTH_STATE_PREFIX + state, userId, OAUTH_STATE_TTL);

        return config.getAuthorizationUrl()
                + "?client_id=" + config.getClientId()
                + "&redirect_uri=" + config.getRedirectUri()
                + "&scope=" + config.getScopes()
                + "&state=" + state
                + "&response_type=code";
    }

    /**
     * Valide le state OAuth et retourne le userId associe.
     * Supprime le state de Redis apres validation (usage unique).
     */
    public String validateAndConsumeState(String state) {
        String key = OAUTH_STATE_PREFIX + state;
        String userId = redisTemplate.opsForValue().get(key);
        if (userId == null) {
            throw new SecurityException("Invalid or expired OAuth state parameter");
        }
        redisTemplate.delete(key);
        return userId;
    }

    /**
     * Echange le code d'autorisation contre un access token.
     * Stocke les tokens chiffres en base.
     */
    @CircuitBreaker(name = "airbnb-oauth")
    public AirbnbConnection exchangeCodeForToken(String code, String userId) {
        log.info("Echange du code OAuth pour l'utilisateur: {}", userId);

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
                    config.getTokenUrl(), params, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                String accessToken = (String) tokenData.get("access_token");
                String refreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = (Integer) tokenData.get("expires_in");
                String airbnbUserId = String.valueOf(tokenData.get("user_id"));

                // Creer ou mettre a jour la connexion
                AirbnbConnection connection = connectionRepository.findByUserId(userId)
                        .orElse(new AirbnbConnection());

                connection.setUserId(userId);
                connection.setAirbnbUserId(airbnbUserId);
                connection.setAccessTokenEncrypted(encryptionService.encrypt(accessToken));
                connection.setRefreshTokenEncrypted(encryptionService.encrypt(refreshToken));
                connection.setTokenExpiresAt(
                        expiresIn != null ? LocalDateTime.now().plusSeconds(expiresIn) : null);
                connection.setScopes(config.getScopes());
                connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                if (connection.getConnectedAt() == null) {
                    connection.setConnectedAt(LocalDateTime.now());
                }

                AirbnbConnection saved = connectionRepository.save(connection);

                // Audit
                auditLogService.logSync("AirbnbConnection", saved.getId().toString(),
                        "Connexion OAuth Airbnb etablie pour user " + userId);

                log.info("Connexion Airbnb etablie pour l'utilisateur: {} (airbnbUserId: {})",
                        userId, airbnbUserId);

                return saved;
            } else {
                throw new RuntimeException("Reponse non-2xx de Airbnb: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Erreur lors de l'echange du code OAuth Airbnb: {}", e.getMessage());

            // Enregistrer l'erreur dans la connexion si elle existe
            connectionRepository.findByUserId(userId).ifPresent(conn -> {
                conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ERROR);
                conn.setErrorMessage(e.getMessage());
                connectionRepository.save(conn);
            });

            throw new RuntimeException("Echec de l'echange OAuth Airbnb", e);
        }
    }

    /**
     * Rafraichit le token d'acces avant expiration.
     */
    @CircuitBreaker(name = "airbnb-oauth")
    public AirbnbConnection refreshToken(String userId) {
        log.info("Rafraichissement du token Airbnb pour l'utilisateur: {}", userId);

        AirbnbConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion Airbnb pour l'utilisateur: " + userId));

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
                    config.getTokenUrl(), params, Map.class);

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
                connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);
            } else {
                throw new RuntimeException("Echec du refresh: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Erreur lors du refresh du token Airbnb: {}", e.getMessage());
            connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.EXPIRED);
            connection.setErrorMessage("Refresh echoue: " + e.getMessage());
            connectionRepository.save(connection);
            throw new RuntimeException("Echec du rafraichissement du token Airbnb", e);
        }
    }

    /**
     * Revoque le token et deconnecte le compte Airbnb.
     */
    @CircuitBreaker(name = "airbnb-oauth")
    public void revokeToken(String userId) {
        log.info("Revocation du token Airbnb pour l'utilisateur: {}", userId);

        AirbnbConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion Airbnb pour l'utilisateur: " + userId));

        try {
            String accessToken = encryptionService.decrypt(connection.getAccessTokenEncrypted());

            // Appel API Airbnb pour revoquer le token
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", config.getClientId());
            params.add("client_secret", config.getClientSecret());
            params.add("token", accessToken);

            restTemplate.postForEntity(config.getApiBaseUrl() + "/oauth2/revoke", params, Void.class);

        } catch (Exception e) {
            log.warn("Erreur lors de la revocation du token cote Airbnb (non-bloquant): {}", e.getMessage());
        }

        // Marquer comme revoque dans tous les cas
        connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
        connection.setAccessTokenEncrypted(null);
        connection.setRefreshTokenEncrypted(null);
        connection.setTokenExpiresAt(null);
        connectionRepository.save(connection);

        // Audit
        auditLogService.logSync("AirbnbConnection", connection.getId().toString(),
                "Connexion Airbnb revoquee pour user " + userId);

        log.info("Connexion Airbnb revoquee pour l'utilisateur: {}", userId);
    }

    /**
     * Retourne un token valide (refresh automatique si necessaire).
     */
    public String getValidAccessToken(String userId) {
        AirbnbConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Aucune connexion Airbnb pour l'utilisateur: " + userId));

        if (connection.getStatus() != AirbnbConnection.AirbnbConnectionStatus.ACTIVE) {
            throw new RuntimeException("Connexion Airbnb non active (statut: " + connection.getStatus() + ")");
        }

        // Verifier si le token est proche de l'expiration (5 min de marge)
        if (connection.getTokenExpiresAt() != null
                && connection.getTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            log.info("Token Airbnb proche de l'expiration, rafraichissement...");
            connection = refreshToken(userId);
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    /**
     * Retourne le statut de la connexion Airbnb pour un utilisateur.
     */
    public Optional<AirbnbConnection> getConnectionStatus(String userId) {
        return connectionRepository.findByUserId(userId);
    }

    /**
     * Verifie si un utilisateur a une connexion Airbnb active.
     */
    public boolean isConnected(String userId) {
        return connectionRepository.findByUserId(userId)
                .map(conn -> conn.getStatus() == AirbnbConnection.AirbnbConnectionStatus.ACTIVE)
                .orElse(false);
    }
}
