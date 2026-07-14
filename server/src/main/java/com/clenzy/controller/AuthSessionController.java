package com.clenzy.controller;

import com.clenzy.config.TokenCookieFilter;
import com.clenzy.service.AuthSessionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Endpoint pour la gestion des cookies HttpOnly de session (pattern BFF).
 *
 * <p>Deux cookies HttpOnly/Secure/SameSite=Strict :</p>
 * <ul>
 *   <li>{@code clenzy_auth} (Path=/) : l'access token, injecte en header
 *       Authorization par {@link TokenCookieFilter} sur chaque requete API ;</li>
 *   <li>{@code clenzy_refresh} (Path=/api/auth) : le refresh token, envoye
 *       UNIQUEMENT aux endpoints d'auth — jamais aux appels API metier — et
 *       jamais lisible en JS. Permet de renouveler la session cote serveur.</li>
 * </ul>
 *
 * <p>Cela elimine le stockage de tokens dans localStorage (vulnerable au XSS)
 * et donne une vraie session glissante : tant que la session SSO Keycloak vit
 * (idle 24h / max 7j), {@code POST /api/auth/session/refresh} renouvelle les cookies —
 * y compris apres un hard refresh ou quand le check-sso Keycloak echoue.</p>
 *
 * <p>Historique du bug corrige : le cookie {@code clenzy_auth} avait un max-age
 * fige a 1h alors que l'access token Keycloak vit 24h — le cookie mourait donc
 * en 1h et l'utilisateur etait deconnecte au moindre rechargement passe ce
 * delai. Les max-age sont desormais cales sur le claim {@code exp} reel des
 * tokens (cf. {@link AuthSessionService#secondsUntilExpiry}).</p>
 *
 * Flow :
 *   1. SPA s'authentifie via Keycloak → recoit access + refresh token en memoire
 *   2. SPA appelle POST /api/auth/session avec Authorization: Bearer &lt;access&gt;
 *      et le header X-Refresh-Token: &lt;refresh&gt;
 *   3. Serveur valide l'access token (Spring Security) et set les 2 cookies
 *   4. Les requetes API suivantes utilisent clenzy_auth (via TokenCookieFilter)
 *   5. A l'expiration : POST /api/auth/session/refresh (cookie clenzy_refresh) rotate les 2 cookies
 */
@RestController
@RequestMapping("/api/auth/session")
public class AuthSessionController {

    private static final Logger log = LoggerFactory.getLogger(AuthSessionController.class);

    /** Cookie porteur du refresh token, scope aux endpoints d'auth. */
    static final String REFRESH_COOKIE_NAME = "clenzy_refresh";
    private static final String REFRESH_COOKIE_PATH = "/api/auth";
    /** Header par lequel le SPA transmet (une seule fois, au login) son refresh token. */
    private static final String REFRESH_TOKEN_HEADER = "X-Refresh-Token";

    private final AuthSessionService authSessionService;
    private final ObjectMapper objectMapper;

    @Value("${server.servlet.session.cookie.secure:true}")
    private boolean secureCookie;

    @Value("${spring.profiles.active:prod}")
    private String activeProfile;

    /** Fallback max-age (s) si l'access token n'expose pas de claim exp parsable. */
    @Value("${clenzy.auth.cookie.max-age:86400}")
    private int accessCookieFallbackMaxAge;

    /** Fallback max-age (s) du cookie refresh (defaut 7j = ssoSessionMaxLifespan). */
    @Value("${clenzy.auth.refresh-cookie.max-age:604800}")
    private int refreshCookieFallbackMaxAge;

    public AuthSessionController(AuthSessionService authSessionService, ObjectMapper objectMapper) {
        this.authSessionService = authSessionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Metadonnees de la session portee par le cookie HttpOnly clenzy_auth.
     *
     * <h3>Pourquoi cet endpoint</h3>
     * Le frontend ne peut pas lire un cookie HttpOnly (par design securite).
     * Au boot (hard refresh), Keycloak JS n'a plus de token en memoire et son
     * check-sso peut echouer (cross-origin, SameSite restrictions, timeout
     * session Keycloak). Cet endpoint permet au frontend de savoir que la
     * session est toujours valide cote backend et de restaurer l'etat UI
     * (claims non sensibles) sans re-login.
     *
     * <h3>Securite (Z1-SEC-FRONTAUX-02)</h3>
     * Cet endpoint ne renvoie JAMAIS le token brut : un echo du token en JSON
     * neutraliserait la protection HttpOnly du cookie (une XSS pourrait
     * l'exfiltrer via un simple fetch). Seules des claims non sensibles
     * (expiration, subject, username, roles) sont exposees — suffisantes pour
     * le bootstrap UI, puisque les appels API portent le cookie HttpOnly
     * automatiquement ({@code credentials: 'include'}).
     *
     * <p>Le {@code TokenCookieFilter} injecte le token du cookie en header
     * Authorization avant la chaine resource-server : si le cookie est valide,
     * Spring Security materialise le principal {@link Jwt} ; sinon la requete
     * arrive ici sans principal et on repond 401.</p>
     */
    @GetMapping
    public ResponseEntity<?> getSession(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Pas de session active"));
        }
        return ResponseEntity.ok(SessionInfoDto.from(jwt));
    }

    /**
     * Claims non sensibles exposees au SPA pour le bootstrap UI apres un hard
     * refresh. Ne contient volontairement PAS le token (Z1-SEC-FRONTAUX-02).
     *
     * @param expiresAt expiration du token (epoch secondes, claim {@code exp})
     */
    public record SessionInfoDto(boolean authenticated,
                                 long expiresAt,
                                 String subject,
                                 String preferredUsername,
                                 String email,
                                 String givenName,
                                 String familyName,
                                 List<String> roles) {

        static SessionInfoDto from(Jwt jwt) {
            long expiresAt = jwt.getExpiresAt() != null ? jwt.getExpiresAt().getEpochSecond() : 0L;
            return new SessionInfoDto(
                    true,
                    expiresAt,
                    jwt.getSubject(),
                    jwt.getClaimAsString("preferred_username"),
                    jwt.getClaimAsString("email"),
                    jwt.getClaimAsString("given_name"),
                    jwt.getClaimAsString("family_name"),
                    extractRealmRoles(jwt));
        }

        private static List<String> extractRealmRoles(Jwt jwt) {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null) {
                return List.of();
            }
            if (!(realmAccess.get("roles") instanceof List<?> roleList)) {
                return List.of();
            }
            return roleList.stream().map(String::valueOf).toList();
        }
    }

    /**
     * Stocke le JWT dans le cookie HttpOnly clenzy_auth, et — si le SPA fournit
     * le header X-Refresh-Token — le refresh token dans clenzy_refresh.
     * L'access token est deja valide par Spring Security (Bearer header requis).
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> createSession(HttpServletRequest request,
                                                              HttpServletResponse response) {
        // Extraire l'access token du header Authorization (deja valide par Spring Security)
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token manquant"));
        }

        String accessToken = authHeader.substring(7);
        setAccessCookie(response, accessToken);

        // Le refresh token est optionnel (compat ascendante). Quand present, on
        // le stocke dans un cookie HttpOnly dedie pour permettre le renouvellement
        // de session cote serveur (POST /api/auth/session/refresh).
        String refreshToken = request.getHeader(REFRESH_TOKEN_HEADER);
        if (refreshToken != null && !refreshToken.isBlank()) {
            setRefreshCookie(response, refreshToken);
        }

        log.debug("Session cookies set for authenticated user");
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /**
     * Renouvelle la session a partir du cookie clenzy_refresh (pattern BFF).
     *
     * <p>Public (dans le {@code permitAll} de {@code /api/auth/**}) car
     * l'access token est justement expire au moment de l'appel — seul le
     * refresh cookie authentifie l'operation. En cas de succes, les 2 cookies
     * sont rotates (rotation du refresh token cote Keycloak) et on renvoie les
     * metadonnees de session (jamais le token brut). En cas d'echec (refresh
     * expire/revoque), on purge les cookies et on repond 401 : le SPA basculera
     * proprement sur un re-login.</p>
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshSession(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Pas de refresh token"));
        }

        Optional<AuthSessionService.RefreshedTokens> refreshed = authSessionService.refresh(refreshToken);
        if (refreshed.isEmpty()) {
            clearCookies(response);
            return ResponseEntity.status(401).body(Map.of("error", "Session expiree"));
        }

        AuthSessionService.RefreshedTokens tokens = refreshed.get();
        setAccessCookie(response, tokens.accessToken());
        setRefreshCookie(response, tokens.refreshToken());

        log.debug("Session refreshed via clenzy_refresh cookie");
        return ResponseEntity.ok(sessionInfoFromRawToken(tokens.accessToken()));
    }

    /**
     * Supprime les cookies de session (logout).
     * Accessible meme sans auth valide (les cookies peuvent etre expires).
     */
    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteSession(HttpServletRequest request,
                                                             HttpServletResponse response) {
        // Audit 2026-07 F2-03 : révoquer la session Keycloak (best-effort) AVANT de purger
        // les cookies, sinon un refresh token capturé survivrait au logout jusqu'à expiration.
        authSessionService.logout(extractRefreshCookie(request));
        clearCookies(response);
        log.debug("Session cookies cleared");
        return ResponseEntity.ok(Map.of("status", "cleared"));
    }

    // ── Cookies ────────────────────────────────────────────────────────────

    private void setAccessCookie(HttpServletResponse response, String accessToken) {
        // Max-age cale sur l'expiration REELLE du token (claim exp), plus sur une
        // constante figee : c'est le correctif du bug historique cookie-1h/token-24h.
        int maxAge = authSessionService.secondsUntilExpiry(accessToken, accessCookieFallbackMaxAge);
        Cookie cookie = new Cookie(TokenCookieFilter.COOKIE_NAME, accessToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(isSecure());
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        int maxAge = authSessionService.secondsUntilExpiry(refreshToken, refreshCookieFallbackMaxAge);
        Cookie cookie = new Cookie(REFRESH_COOKIE_NAME, refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(isSecure());
        // Scope aux endpoints d'auth : le refresh token n'est jamais envoye aux
        // appels API metier, reduisant sa surface d'exposition.
        cookie.setPath(REFRESH_COOKIE_PATH);
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearCookies(HttpServletResponse response) {
        Cookie auth = new Cookie(TokenCookieFilter.COOKIE_NAME, "");
        auth.setHttpOnly(true);
        auth.setSecure(isSecure());
        auth.setPath("/");
        auth.setMaxAge(0);
        auth.setAttribute("SameSite", "Strict");
        response.addCookie(auth);

        Cookie refresh = new Cookie(REFRESH_COOKIE_NAME, "");
        refresh.setHttpOnly(true);
        refresh.setSecure(isSecure());
        refresh.setPath(REFRESH_COOKIE_PATH);
        refresh.setMaxAge(0);
        refresh.setAttribute("SameSite", "Strict");
        response.addCookie(refresh);
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value != null && !value.isBlank()) ? value : null;
            }
        }
        return null;
    }

    private boolean isSecure() {
        // En dev (HTTP), pas de flag Secure sinon le cookie n'est pas envoye
        return !"dev".equals(activeProfile) && secureCookie;
    }

    // ── Decodage des claims du nouvel access token (endpoint /refresh) ────────

    /**
     * Construit les metadonnees de session a partir du payload d'un access token
     * fraichement emis. Contrairement a {@link SessionInfoDto#from(Jwt)}, on n'a
     * pas de principal {@link Jwt} materialise ici (endpoint public), donc on lit
     * les claims directement depuis le payload JWT. Le token n'est PAS renvoye.
     */
    private SessionInfoDto sessionInfoFromRawToken(String accessToken) {
        JsonNode claims = decodePayload(accessToken);
        if (claims == null) {
            return new SessionInfoDto(true, 0L, null, null, null, null, null, List.of());
        }
        List<String> roles = new ArrayList<>();
        JsonNode roleArray = claims.path("realm_access").path("roles");
        if (roleArray.isArray()) {
            roleArray.forEach(node -> roles.add(node.asText()));
        }
        return new SessionInfoDto(
                true,
                claims.path("exp").asLong(0L),
                claims.path("sub").asText(null),
                claims.path("preferred_username").asText(null),
                claims.path("email").asText(null),
                claims.path("given_name").asText(null),
                claims.path("family_name").asText(null),
                roles);
    }

    private JsonNode decodePayload(String jwt) {
        if (jwt == null) {
            return null;
        }
        String[] parts = jwt.split("\\.");
        if (parts.length != 3) {
            return null;
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            return objectMapper.readTree(payload);
        } catch (RuntimeException | java.io.IOException e) {
            return null;
        }
    }
}
