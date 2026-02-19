package com.clenzy.integration.minut.service;

import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Service OAuth2 pour l'integration Minut.
 * Gere : autorisation, echange de code, refresh token, revocation.
 */
@Service
public class MinutOAuthService {

    private static final Logger log = LoggerFactory.getLogger(MinutOAuthService.class);

    private final MinutConfig config;
    private final MinutConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;
    private final RestTemplate restTemplate;

    public MinutOAuthService(MinutConfig config,
                             MinutConnectionRepository connectionRepository,
                             TokenEncryptionService encryptionService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Genere l'URL de redirection vers Minut pour l'autorisation OAuth.
     */
    public String getAuthorizationUrl(String userId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("Configuration Minut incomplete. Verifiez les variables d'environnement MINUT_CLIENT_ID, MINUT_CLIENT_SECRET, MINUT_REDIRECT_URI.");
        }

        return config.getAuthorizationUrl()
                + "?client_id=" + config.getClientId()
                + "&redirect_uri=" + config.getRedirectUri()
                + "&scope=" + config.getScopes()
                + "&state=" + userId
                + "&response_type=code";
    }

    /**
     * Echange le code d'autorisation contre un access token.
     */
    @SuppressWarnings("unchecked")
    public MinutConnection exchangeCodeForToken(String code, String userId) {
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

                String accessToken = (String) tokenData.get("access_token");
                String refreshToken = (String) tokenData.get("refresh_token");
                Integer expiresIn = tokenData.get("expires_in") != null
                        ? ((Number) tokenData.get("expires_in")).intValue() : 3600;
                String minutUserId = tokenData.get("user_id") != null
                        ? String.valueOf(tokenData.get("user_id")) : null;

                MinutConnection connection = connectionRepository.findByUserId(userId)
                        .orElse(new MinutConnection());

                connection.setUserId(userId);
                connection.setMinutUserId(minutUserId);
                connection.setAccessTokenEncrypted(encryptionService.encrypt(accessToken));
                connection.setRefreshTokenEncrypted(encryptionService.encrypt(refreshToken));
                connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                connection.setScopes(config.getScopes());
                connection.setStatus(MinutConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);
            }

            throw new RuntimeException("Reponse non-2xx de Minut: " + response.getStatusCode());

        } catch (Exception e) {
            log.error("Erreur echange code OAuth Minut: {}", e.getMessage());
            throw new RuntimeException("Echec de l'echange de code Minut", e);
        }
    }

    /**
     * Rafraichit le token OAuth.
     */
    @SuppressWarnings("unchecked")
    public MinutConnection refreshToken(MinutConnection connection) {
        log.info("Rafraichissement du token Minut pour l'utilisateur: {}", connection.getUserId());

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
                        ? ((Number) tokenData.get("expires_in")).intValue() : 3600;

                connection.setAccessTokenEncrypted(encryptionService.encrypt(newAccessToken));
                if (newRefreshToken != null) {
                    connection.setRefreshTokenEncrypted(encryptionService.encrypt(newRefreshToken));
                }
                connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                connection.setStatus(MinutConnectionStatus.ACTIVE);
                connection.setErrorMessage(null);

                return connectionRepository.save(connection);
            }

            connection.setStatus(MinutConnectionStatus.ERROR);
            connection.setErrorMessage("Echec refresh: " + response.getStatusCode());
            return connectionRepository.save(connection);

        } catch (Exception e) {
            log.error("Erreur refresh token Minut: {}", e.getMessage());
            connection.setStatus(MinutConnectionStatus.ERROR);
            connection.setErrorMessage("Erreur refresh: " + e.getMessage());
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
            connection = refreshToken(connection);
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
        connectionRepository.findByUserId(userId).ifPresent(connection -> {
            try {
                String accessToken = encryptionService.decrypt(connection.getAccessTokenEncrypted());
                if (accessToken != null) {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                    headers.setBearerAuth(accessToken);

                    MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
                    params.add("token", accessToken);

                    restTemplate.postForEntity(
                            config.getApiBaseUrl() + "/oauth/revoke",
                            new HttpEntity<>(params, headers),
                            Void.class);
                }
            } catch (Exception e) {
                log.warn("Erreur lors de la revocation du token Minut (continue quand meme): {}", e.getMessage());
            }

            connection.setStatus(MinutConnectionStatus.REVOKED);
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
