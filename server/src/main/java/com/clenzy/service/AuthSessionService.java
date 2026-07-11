package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.Map;
import java.util.Optional;

/**
 * Rafraichissement des sessions PMS via le refresh_token grant Keycloak
 * (realm {@code clenzy}, client public {@code clenzy-web}).
 *
 * <p>Ce service materialise le pattern BFF : le refresh token vit dans un
 * cookie HttpOnly ({@code clenzy_refresh}) que le JS ne peut pas lire. Quand
 * l'access token expire (ou apres un hard refresh sans token en memoire), le
 * SPA appelle {@code POST /api/auth/session/refresh} ; le backend echange le refresh
 * token contre un nouveau couple access/refresh cote serveur et repose les
 * cookies. Le SPA n'a jamais besoin de manipuler le token lui-meme.</p>
 *
 * <p>Miroir cote guest : {@code BookingGuestAuthService#refreshToken}.</p>
 */
@Service
public class AuthSessionService {

    private static final Logger log = LoggerFactory.getLogger(AuthSessionService.class);

    private final RestTemplate restTemplate;

    @Value("${keycloak.auth-server-url:http://clenzy-keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    @Value("${keycloak.resource:clenzy-web}")
    private String clientId;

    /** {@code clenzy-web} est un client public : ce secret reste vide en pratique. */
    @Value("${keycloak.credentials.secret:}")
    private String clientSecret;

    public AuthSessionService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Nouveau couple de tokens issu d'un refresh_token grant.
     *
     * @param accessToken  nouvel access token JWT
     * @param refreshToken nouveau refresh token (rotation Keycloak)
     */
    public record RefreshedTokens(String accessToken, String refreshToken) {}

    /**
     * Echange un refresh token contre un nouveau couple access/refresh.
     *
     * @return les nouveaux tokens, ou {@link Optional#empty()} si le refresh
     *         token est invalide/expire (session Keycloak terminee) ou si
     *         Keycloak est injoignable.
     */
    @SuppressWarnings("unchecked")
    public Optional<RefreshedTokens> refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return Optional.empty();
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", clientId);
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }
        form.add("refresh_token", refreshToken);

        String tokenUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(form, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(tokenUrl, HttpMethod.POST, request, Map.class);
            Map<String, Object> body = response.getBody();
            if (!response.getStatusCode().is2xxSuccessful() || body == null) {
                return Optional.empty();
            }
            String access = (String) body.get("access_token");
            String refresh = (String) body.get("refresh_token");
            if (access == null || refresh == null) {
                return Optional.empty();
            }
            return Optional.of(new RefreshedTokens(access, refresh));
        } catch (HttpClientErrorException e) {
            // 400/401 = refresh token expire ou session revoquee : cas nominal,
            // le SPA basculera sur un re-login. Pas d'alerte, log au niveau debug.
            log.debug("Refresh Keycloak refuse ({}) — session probablement expiree", e.getStatusCode());
            return Optional.empty();
        } catch (RuntimeException e) {
            log.warn("Erreur lors du refresh Keycloak: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Duree de vie restante (secondes) d'un JWT, lue depuis son claim {@code exp}.
     * Sert a caler le max-age d'un cookie sur l'expiration reelle du token
     * plutot que sur une constante figee (cause historique des deconnexions :
     * cookie 1h alors que le token vit 24h).
     *
     * @param token    JWT (access ou refresh) — un token opaque renvoie le fallback
     * @param fallback valeur en secondes si le token n'est pas un JWT parsable
     * @return le nombre de secondes jusqu'a expiration, borne >= 1, ou {@code fallback}
     */
    public int secondsUntilExpiry(String token, int fallback) {
        Long exp = extractExp(token);
        if (exp == null) {
            return fallback;
        }
        long remaining = exp - (System.currentTimeMillis() / 1000L);
        if (remaining <= 0) {
            return fallback;
        }
        return (int) Math.min(remaining, Integer.MAX_VALUE);
    }

    /** Lit le claim {@code exp} (epoch secondes) du payload d'un JWT, ou null si illisible. */
    private Long extractExp(String token) {
        if (token == null) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return null;
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            String json = new String(payload);
            int idx = json.indexOf("\"exp\"");
            if (idx < 0) {
                return null;
            }
            int colon = json.indexOf(':', idx);
            if (colon < 0) {
                return null;
            }
            StringBuilder digits = new StringBuilder();
            for (int i = colon + 1; i < json.length(); i++) {
                char c = json.charAt(i);
                if (Character.isDigit(c)) {
                    digits.append(c);
                } else if (digits.length() > 0) {
                    break;
                }
            }
            return digits.length() > 0 ? Long.parseLong(digits.toString()) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
