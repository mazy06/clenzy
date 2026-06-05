package com.clenzy.integration.netatmo.service;

import com.clenzy.integration.netatmo.config.NetatmoConfig;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.model.NetatmoConnection.NetatmoConnectionStatus;
import com.clenzy.integration.netatmo.repository.NetatmoConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service OAuth2 pour l'integration Netatmo (API Connect).
 * Calque sur {@code MinutOAuthService} : autorisation (state CSRF en Redis),
 * echange de code, refresh, revocation. Specificites Netatmo : scopes separes
 * par espaces (URL-encodes), pas d'endpoint de revocation distant (revocation
 * locale uniquement).
 */
@Service
public class NetatmoOAuthService {

    private static final Logger log = LoggerFactory.getLogger(NetatmoOAuthService.class);
    private static final String OAUTH_STATE_PREFIX = "oauth:netatmo:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);

    private final NetatmoConfig config;
    private final NetatmoPlatformConfigService configService;
    private final NetatmoConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    public NetatmoOAuthService(NetatmoConfig config,
                               NetatmoPlatformConfigService configService,
                               NetatmoConnectionRepository connectionRepository,
                               TokenEncryptionService encryptionService,
                               TenantContext tenantContext,
                               StringRedisTemplate redisTemplate,
                               RestTemplate restTemplate) {
        this.config = config;
        this.configService = configService;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
        this.redisTemplate = redisTemplate;
        this.restTemplate = restTemplate;
    }

    /**
     * URL de redirection vers Netatmo pour l'autorisation OAuth.
     * State CSRF aleatoire stocke en Redis (TTL 10 min).
     */
    public String getAuthorizationUrl(String userId) {
        if (!configService.isConfigured()) {
            throw new IllegalStateException("Configuration Netatmo incomplete. Verifiez NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET, NETATMO_REDIRECT_URI.");
        }

        String state = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(OAUTH_STATE_PREFIX + state, userId, OAUTH_STATE_TTL);

        return config.getAuthorizationUrl()
                + "?client_id=" + enc(configService.getClientId())
                + "&redirect_uri=" + enc(configService.getRedirectUri())
                + "&scope=" + enc(config.getScopes())
                + "&state=" + enc(state)
                + "&response_type=code";
    }

    /**
     * Valide le state OAuth (usage unique) et retourne le userId associe.
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
     */
    @SuppressWarnings("unchecked")
    public NetatmoConnection exchangeCodeForToken(String code, String userId) {
        log.info("Echange du code OAuth Netatmo pour l'utilisateur: {}", userId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", configService.getClientId());
        params.add("client_secret", configService.getClientSecret());
        params.add("code", code);
        params.add("redirect_uri", configService.getRedirectUri());
        params.add("grant_type", "authorization_code");
        params.add("scope", config.getScopes());

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(),
                    new HttpEntity<>(params, headers),
                    Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                String accessToken = (String) tokenData.get("access_token");
                String refreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = tokenData.get("expires_in") != null
                        ? ((Number) tokenData.get("expires_in")).intValue() : 10800;

                NetatmoConnection connection = connectionRepository.findByUserId(userId)
                        .orElse(new NetatmoConnection());

                connection.setUserId(userId);
                connection.setAccessTokenEncrypted(encryptionService.encrypt(accessToken));
                connection.setRefreshTokenEncrypted(encryptionService.encrypt(refreshToken));
                connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                connection.setScopes(config.getScopes());
                connection.setStatus(NetatmoConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);
                if (connection.getOrganizationId() == null) {
                    connection.setOrganizationId(tenantContext.getRequiredOrganizationId());
                }

                return connectionRepository.save(connection);
            }

            throw new RuntimeException("Reponse non-2xx de Netatmo: " + response.getStatusCode());

        } catch (Exception e) {
            log.error("Erreur echange code OAuth Netatmo: {}", e.getMessage());
            throw new RuntimeException("Echec de l'echange de code Netatmo", e);
        }
    }

    /**
     * Rafraichit le token OAuth.
     */
    @SuppressWarnings("unchecked")
    public NetatmoConnection refreshToken(NetatmoConnection connection) {
        log.info("Rafraichissement du token Netatmo pour l'utilisateur: {}", connection.getUserId());

        String refreshToken = encryptionService.decrypt(connection.getRefreshTokenEncrypted());
        if (refreshToken == null || refreshToken.isEmpty()) {
            connection.setStatus(NetatmoConnectionStatus.EXPIRED);
            connection.setErrorMessage("Refresh token manquant");
            return connectionRepository.save(connection);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", configService.getClientId());
        params.add("client_secret", configService.getClientSecret());
        params.add("refresh_token", refreshToken);
        params.add("grant_type", "refresh_token");

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(),
                    new HttpEntity<>(params, headers),
                    Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                String newAccessToken = (String) tokenData.get("access_token");
                String newRefreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = tokenData.get("expires_in") != null
                        ? ((Number) tokenData.get("expires_in")).intValue() : 10800;

                connection.setAccessTokenEncrypted(encryptionService.encrypt(newAccessToken));
                if (newRefreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptionService.encrypt(newRefreshToken));
                }
                connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                connection.setStatus(NetatmoConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);
            }

            connection.setStatus(NetatmoConnectionStatus.ERROR);
            connection.setErrorMessage("Echec refresh: " + response.getStatusCode());
            return connectionRepository.save(connection);

        } catch (Exception e) {
            log.error("Erreur refresh token Netatmo: {}", e.getMessage());
            connection.setStatus(NetatmoConnectionStatus.ERROR);
            connection.setErrorMessage("Erreur refresh: " + e.getMessage());
            return connectionRepository.save(connection);
        }
    }

    /**
     * Access token valide (refresh auto si expire dans moins de 5 min).
     */
    public String getValidAccessToken(String userId) {
        NetatmoConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("Aucune connexion Netatmo pour l'utilisateur " + userId));

        if (!connection.isActive()) {
            throw new IllegalStateException("Connexion Netatmo inactive (statut: " + connection.getStatus() + ")");
        }

        if (connection.getTokenExpiresAt() != null
                && connection.getTokenExpiresAt().minusMinutes(5).isBefore(LocalDateTime.now())) {
            connection = refreshToken(connection);
            if (!connection.isActive()) {
                throw new IllegalStateException("Echec du rafraichissement du token Netatmo");
            }
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    /**
     * Revoque la connexion. Netatmo n'expose pas d'endpoint de revocation standard
     * → on revoque localement (statut REVOKED), les tokens deviennent inutilisables.
     */
    public void revokeToken(String userId) {
        connectionRepository.findByUserId(userId).ifPresent(connection -> {
            connection.setStatus(NetatmoConnectionStatus.REVOKED);
            connectionRepository.save(connection);
        });
    }

    public boolean isConnected(String userId) {
        return connectionRepository.findByUserId(userId)
                .map(NetatmoConnection::isActive)
                .orElse(false);
    }

    public Optional<NetatmoConnection> getConnectionStatus(String userId) {
        return connectionRepository.findByUserId(userId);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
