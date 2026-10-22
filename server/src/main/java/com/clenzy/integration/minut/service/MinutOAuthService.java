package com.clenzy.integration.minut.service;

import com.clenzy.integration.oauth.BaitlyOAuthDiagnostics;
import com.clenzy.integration.oauth.BaitlyOAuthConnectionGuard;
import static com.clenzy.integration.oauth.BaitlyOAuthDiagnostics.Operation.*;

import com.clenzy.integration.oauth.BaitlyOAuthTokenResponse;
import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
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

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service OAuth2 pour l'integration Minut.
 * Gere : autorisation, echange de code, refresh token, revocation.
 */
@Service
public class MinutOAuthService {

    private static final Logger log = LoggerFactory.getLogger(MinutOAuthService.class);
    private static final String OAUTH_STATE_PREFIX = "oauth:minut:state:";
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);

    private final MinutConfig config;
    private final MinutConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;
    private final BaitlyOAuthConnectionGuard connectionGuard;

    public MinutOAuthService(MinutConfig config,
                             MinutConnectionRepository connectionRepository,
                             TokenEncryptionService encryptionService,
                             TenantContext tenantContext,
                             StringRedisTemplate redisTemplate,
                             RestTemplate restTemplate, BaitlyOAuthConnectionGuard connectionGuard) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
        this.redisTemplate = redisTemplate;
        this.restTemplate = restTemplate;
        this.connectionGuard = connectionGuard;
    }

    /**
     * Genere l'URL de redirection vers Minut pour l'autorisation OAuth.
     * Utilise un state CSRF aleatoire stocke en Redis (TTL 10 min).
     */
    public String getAuthorizationUrl(String userId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("Configuration Minut incomplete. Verifiez les variables d'environnement MINUT_CLIENT_ID, MINUT_CLIENT_SECRET, MINUT_REDIRECT_URI.");
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
     * Consomme atomiquement le state Redis (usage unique).
     */
    public String validateAndConsumeState(String state) {
        if (state == null || state.isBlank()) throw new SecurityException("Invalid or expired OAuth state parameter");
        String key = OAUTH_STATE_PREFIX + state;
        String userId = redisTemplate.opsForValue().getAndDelete(key);
        if (userId == null) {
            throw new SecurityException("Invalid or expired OAuth state parameter");
        }
        return userId;
    }

    /**
     * Echange le code d'autorisation contre un access token.
     */
    @SuppressWarnings("unchecked")
    public MinutConnection exchangeCodeForToken(String code, String userId) {
        return connectionGuard.executeForUser("minut", userId,
                () -> exchangeUnderLock(code, userId));
    }

    private MinutConnection exchangeUnderLock(String code, String userId) {
        log.info("Echange du code OAuth Minut pour l'utilisateur: {}", userId);

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
                    config.getTokenUrl(),
                    new HttpEntity<>(params, headers),
                    Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                var tokens = BaitlyOAuthTokenResponse.parse(tokenData, 3600);
                String accessToken = tokens.accessToken();
                String refreshToken = tokens.refreshToken();
                Integer expiresIn = tokens.expiresIn();
                String minutUserId = tokenData.get("user_id") != null
                        ? String.valueOf(tokenData.get("user_id")) : null;

                MinutConnection connection = connectionRepository.findByUserId(userId)
                        .orElse(new MinutConnection());

                // Préparer tous les secrets et dates avant de modifier la connexion Baitly.
                String encryptedAccess = encryptionService.encrypt(accessToken);
                String encryptedRefresh = refreshToken != null ? encryptionService.encrypt(refreshToken) : null;
                LocalDateTime tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn);

                connection.setUserId(userId);
                connection.setMinutUserId(minutUserId);
                connection.setAccessTokenEncrypted(encryptedAccess);
                connection.setRefreshTokenEncrypted(encryptedRefresh);
                connection.setTokenExpiresAt(tokenExpiresAt);
                connection.setScopes(config.getScopes());
                connection.setStatus(MinutConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);
                if (connection.getOrganizationId() == null) {
                    connection.setOrganizationId(tenantContext.getRequiredOrganizationId());
                }

                return connectionRepository.save(connection);
            }

            throw new RuntimeException("Reponse non-2xx de Minut: " + response.getStatusCode());

        } catch (Exception e) {
            log.error("Échec OAuth minut", BaitlyOAuthDiagnostics.failure(EXCHANGE, e));
            throw BaitlyOAuthDiagnostics.failure(EXCHANGE, e);
        }
    }

    /**
     * Rafraichit le token OAuth.
     */
    @SuppressWarnings("unchecked")
    public MinutConnection refreshToken(MinutConnection connection) {
        String userId = connection.getUserId();
        return connectionGuard.executeUserRefresh("minut", userId,
                () -> refreshUnderLock(userId, false));
    }

    private MinutConnection refreshUnderLock(String userId, boolean onlyIfExpiring) {
        MinutConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("Connexion OAuth indisponible"));
        log.info("Rafraichissement du token Minut pour l'utilisateur: {}", connection.getUserId());

        if (!connection.isActive()) throw new IllegalStateException("Connexion OAuth inactive ; reconnexion requise");
        if (onlyIfExpiring && (connection.getTokenExpiresAt() == null
                || !connection.getTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5)))) return connection;

        try {
            String refreshToken = encryptionService.decrypt(connection.getRefreshTokenEncrypted());
            if (refreshToken == null || refreshToken.isEmpty()) {
                connection.setStatus(MinutConnectionStatus.EXPIRED);
                connection.setErrorMessage("Refresh token manquant");
                return connectionRepository.save(connection);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", config.getClientId());
            params.add("client_secret", config.getClientSecret());
            params.add("refresh_token", refreshToken);
            params.add("grant_type", "refresh_token");

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    config.getTokenUrl(),
                    new HttpEntity<>(params, headers),
                    Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> tokenData = response.getBody();

                var tokens = BaitlyOAuthTokenResponse.parse(tokenData, 3600);
                String newAccessToken = tokens.accessToken();
                String newRefreshToken = tokens.refreshToken();
                Integer expiresIn = tokens.expiresIn();

                // Préparer tous les secrets et dates avant de modifier la connexion Baitly.
                String encryptedAccess = encryptionService.encrypt(newAccessToken);
                String encryptedRefresh = newRefreshToken != null ? encryptionService.encrypt(newRefreshToken) : null;
                LocalDateTime tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn);

                connection.setAccessTokenEncrypted(encryptedAccess);
                if (newRefreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptedRefresh);
                }
                connection.setTokenExpiresAt(tokenExpiresAt);
                connection.setStatus(MinutConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);
            }

            connection.setStatus(MinutConnectionStatus.ERROR);
            connection.setErrorMessage(BaitlyOAuthDiagnostics.message(REFRESH));
            return connectionRepository.save(connection);

        } catch (Exception e) {
            log.error("Échec OAuth minut", BaitlyOAuthDiagnostics.failure(REFRESH, e));
            connection.setStatus(MinutConnectionStatus.ERROR);
            connection.setErrorMessage(BaitlyOAuthDiagnostics.message(REFRESH));
            return connectionRepository.save(connection);
        }
    }

    /**
     * Retourne un access token valide pour l'utilisateur.
     * Rafraichit automatiquement si expire (5 min de marge).
     */
    public String getValidAccessToken(String userId) {
        MinutConnection connection = connectionRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("Aucune connexion Minut pour l'utilisateur " + userId));

        if (!connection.isActive()) {
            throw new IllegalStateException("Connexion Minut inactive (statut: " + connection.getStatus() + ")");
        }

        // Refresh si expire dans moins de 5 minutes
        if (connection.getTokenExpiresAt() != null
                && connection.getTokenExpiresAt().minusMinutes(5).isBefore(LocalDateTime.now())) {
            connection = connectionGuard.executeUserRefresh("minut", userId,
                    () -> refreshUnderLock(userId, true));
            if (!connection.isActive()) {
                throw new IllegalStateException("Echec du rafraichissement du token Minut");
            }
        }

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    /**
     * Revoque le token et deconnecte l'utilisateur.
     */
    public void revokeToken(String userId) {
        connectionGuard.executeForUser("minut", userId, () -> {
            revokeUnderLock(userId);
            return null;
        });
    }

    private void revokeUnderLock(String userId) {
        connectionRepository.findByUserId(userId).ifPresent(connection -> {
            boolean remoteConfirmed = false;
            try {
                String accessToken = encryptionService.decrypt(connection.getAccessTokenEncrypted());
                if (accessToken != null) {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                    headers.setBearerAuth(accessToken);

                    MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
                    params.add("token", accessToken);

                    var response = restTemplate.postForEntity(
                            config.getApiBaseUrl() + "/oauth/revoke",
                            new HttpEntity<>(params, headers),
                            Void.class);
                    remoteConfirmed = response != null && response.getStatusCode().is2xxSuccessful();
                }
            } catch (Exception e) {
                log.warn("Révocation OAuth minut non confirmée", BaitlyOAuthDiagnostics.failure(REVOKE, e));
            }

            connection.setStatus(MinutConnectionStatus.REVOKED);
            connection.setAccessTokenEncrypted(""); // Colonne historique NOT NULL : aucun secret conservé.
            connection.setRefreshTokenEncrypted(null);
            connection.setTokenExpiresAt(null);
            connection.setErrorMessage(remoteConfirmed ? null : BaitlyOAuthDiagnostics.message(REVOKE));
            connectionRepository.save(connection);
        });
    }

    public boolean isConnected(String userId) {
        return connectionRepository.findByUserId(userId)
                .map(MinutConnection::isActive)
                .orElse(false);
    }

    public Optional<MinutConnection> getConnectionStatus(String userId) {
        return connectionRepository.findByUserId(userId);
    }
}
