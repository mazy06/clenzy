package com.clenzy.controller;

import com.clenzy.config.TokenCookieFilter;
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

import java.util.List;
import java.util.Map;

/**
 * Endpoint pour la gestion du cookie HttpOnly de session.
 * Le SPA envoie le token Keycloak (deja valide par le JWT resource server)
 * et le serveur le stocke dans un cookie HttpOnly/Secure/SameSite=Strict.
 *
 * Cela elimine le stockage de tokens dans localStorage (vulnerable au XSS).
 *
 * Flow :
 *   1. SPA s'authentifie via Keycloak → recoit le JWT en memoire
 *   2. SPA appelle POST /api/auth/session avec Authorization: Bearer <token>
 *   3. Serveur valide le JWT (Spring Security) et set le cookie HttpOnly
 *   4. Les requetes suivantes utilisent le cookie (via TokenCookieFilter)
 *   5. SPA supprime le token du localStorage
 */
@RestController
@RequestMapping("/api/auth/session")
public class AuthSessionController {

    private static final Logger log = LoggerFactory.getLogger(AuthSessionController.class);

    @Value("${server.servlet.session.cookie.secure:true}")
    private boolean secureCookie;

    @Value("${spring.profiles.active:prod}")
    private String activeProfile;

    @Value("${clenzy.auth.cookie.max-age:3600}")
    private int cookieMaxAge;

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
     * Stocke le JWT dans un cookie HttpOnly.
     * Le token est deja valide par Spring Security (Bearer header requis).
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> createSession(HttpServletRequest request,
                                                              HttpServletResponse response) {
        // Extraire le token du header Authorization (deja valide par Spring Security)
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token manquant"));
        }

        String token = authHeader.substring(7);
        setCookieOnResponse(response, token);

        log.debug("Session cookie set for authenticated user");
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /**
     * Supprime le cookie de session (logout).
     * Accessible meme sans auth valide (le cookie peut etre expire).
     */
    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteSession(HttpServletResponse response) {
        Cookie cookie = new Cookie(TokenCookieFilter.COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(isSecure());
        cookie.setPath("/");
        cookie.setMaxAge(0); // Suppression immediate
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);

        log.debug("Session cookie cleared");
        return ResponseEntity.ok(Map.of("status", "cleared"));
    }

    private void setCookieOnResponse(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(TokenCookieFilter.COOKIE_NAME, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(isSecure());
        cookie.setPath("/");
        // Max-age = 1h (aligne sur le TTL du JWT Keycloak).
        // Le SPA appelle POST /api/auth/session a chaque refresh de token
        // pour mettre a jour le cookie avant expiration.
        cookie.setMaxAge(cookieMaxAge);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private boolean isSecure() {
        // En dev (HTTP), pas de flag Secure sinon le cookie n'est pas envoye
        return !"dev".equals(activeProfile) && secureCookie;
    }
}
