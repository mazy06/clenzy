package com.clenzy.controller;

import com.clenzy.config.TokenCookieFilter;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link AuthSessionController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>GET /api/auth/session : 200 avec metadonnees non sensibles (JAMAIS le token brut
 *       — Z1-SEC-FRONTAUX-02) si principal JWT present, 401 sinon</li>
 *   <li>POST /api/auth/session : pose un cookie HttpOnly/Secure/SameSite=Strict, 400 si pas de header</li>
 *   <li>DELETE /api/auth/session : pose un cookie max-age=0 (suppression)</li>
 *   <li>isSecure : false en dev, secureCookie param sinon</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class AuthSessionControllerTest {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    private AuthSessionController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthSessionController();
        ReflectionTestUtils.setField(controller, "secureCookie", true);
        ReflectionTestUtils.setField(controller, "activeProfile", "prod");
        ReflectionTestUtils.setField(controller, "cookieMaxAge", 3600);
    }

    // ─── GET /api/auth/session ───────────────────────────────────────────

    private static final String RAW_TOKEN = "raw-jwt-value-must-never-leak";

    private static Jwt jwtWithClaims() {
        return Jwt.withTokenValue(RAW_TOKEN)
                .header("alg", "RS256")
                .subject("kc-user-1")
                .claim("preferred_username", "host1")
                .claim("email", "host@clenzy.fr")
                .claim("given_name", "Jean")
                .claim("family_name", "Dupont")
                .claim("realm_access", Map.of("roles", List.of("HOST", "SUPERVISOR")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    @DisplayName("getSession avec principal JWT retourne les metadonnees de session")
    void getSession_withJwtPrincipal_returnsSessionMetadata() {
        Jwt jwt = jwtWithClaims();

        ResponseEntity<?> result = controller.getSession(jwt);

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        AuthSessionController.SessionInfoDto body = (AuthSessionController.SessionInfoDto) result.getBody();
        assertThat(body).isNotNull();
        assertThat(body.authenticated()).isTrue();
        assertThat(body.expiresAt()).isEqualTo(jwt.getExpiresAt().getEpochSecond());
        assertThat(body.subject()).isEqualTo("kc-user-1");
        assertThat(body.preferredUsername()).isEqualTo("host1");
        assertThat(body.email()).isEqualTo("host@clenzy.fr");
        assertThat(body.givenName()).isEqualTo("Jean");
        assertThat(body.familyName()).isEqualTo("Dupont");
        assertThat(body.roles()).containsExactly("HOST", "SUPERVISOR");
    }

    @Test
    @DisplayName("getSession ne renvoie JAMAIS le token brut (Z1-SEC-FRONTAUX-02)")
    void getSession_withJwtPrincipal_neverEchoesRawToken() {
        ResponseEntity<?> result = controller.getSession(jwtWithClaims());

        // Le DTO ne doit contenir le token brut dans aucun de ses champs.
        assertThat(String.valueOf(result.getBody())).doesNotContain(RAW_TOKEN);
    }

    @Test
    @DisplayName("getSession retourne 401 sans principal JWT (pas de cookie valide)")
    void getSession_withoutJwtPrincipal_returns401() {
        ResponseEntity<?> result = controller.getSession(null);

        assertThat(result.getStatusCode().value()).isEqualTo(401);
        assertThat(result.getBody()).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsKey("error");
    }

    @Test
    @DisplayName("getSession sans claim realm_access retourne une liste de roles vide")
    void getSession_withoutRealmAccessClaim_returnsEmptyRoles() {
        Jwt jwt = Jwt.withTokenValue(RAW_TOKEN)
                .header("alg", "RS256")
                .subject("kc-user-2")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();

        ResponseEntity<?> result = controller.getSession(jwt);

        AuthSessionController.SessionInfoDto body = (AuthSessionController.SessionInfoDto) result.getBody();
        assertThat(body).isNotNull();
        assertThat(body.roles()).isEmpty();
    }

    @Test
    @DisplayName("getSession avec realm_access.roles malforme (non-liste) retourne une liste vide")
    void getSession_withMalformedRealmRoles_returnsEmptyRoles() {
        Jwt jwt = Jwt.withTokenValue(RAW_TOKEN)
                .header("alg", "RS256")
                .subject("kc-user-3")
                .claim("realm_access", Map.of("roles", "HOST"))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();

        ResponseEntity<?> result = controller.getSession(jwt);

        AuthSessionController.SessionInfoDto body = (AuthSessionController.SessionInfoDto) result.getBody();
        assertThat(body).isNotNull();
        assertThat(body.roles()).isEmpty();
    }

    // ─── POST /api/auth/session ──────────────────────────────────────────

    @Test
    @DisplayName("createSession returns 400 when no Authorization header")
    void createSession_noHeader_returns400() {
        when(request.getHeader("Authorization")).thenReturn(null);

        ResponseEntity<Map<String, String>> result = controller.createSession(request, response);

        assertThat(result.getStatusCode().value()).isEqualTo(400);
        assertThat(result.getBody()).containsKey("error");
    }

    @Test
    @DisplayName("createSession returns 400 when Authorization is not Bearer")
    void createSession_nonBearerAuth_returns400() {
        when(request.getHeader("Authorization")).thenReturn("ApiKey foo");

        ResponseEntity<Map<String, String>> result = controller.createSession(request, response);

        assertThat(result.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    @DisplayName("createSession sets cookie HttpOnly/Secure/SameSite=Strict + max-age in prod")
    void createSession_validBearer_setsCookieWithCorrectAttributes() {
        when(request.getHeader("Authorization")).thenReturn("Bearer xyz-token");

        ResponseEntity<Map<String, String>> result = controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());

        Cookie cookie = cookieCaptor.getValue();
        assertThat(cookie.getName()).isEqualTo(TokenCookieFilter.COOKIE_NAME);
        assertThat(cookie.getValue()).isEqualTo("xyz-token");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getMaxAge()).isEqualTo(3600);
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Strict");

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("status", "ok");
    }

    @Test
    @DisplayName("createSession in dev profile does NOT set Secure flag")
    void createSession_devProfile_noSecureFlag() {
        ReflectionTestUtils.setField(controller, "activeProfile", "dev");
        when(request.getHeader("Authorization")).thenReturn("Bearer dev-token");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getSecure()).isFalse();
    }

    @Test
    @DisplayName("createSession with secureCookie=false in prod does NOT set Secure flag")
    void createSession_secureCookieDisabled_noSecureFlag() {
        ReflectionTestUtils.setField(controller, "secureCookie", false);
        when(request.getHeader("Authorization")).thenReturn("Bearer t");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getSecure()).isFalse();
    }

    @Test
    @DisplayName("createSession uses configured cookieMaxAge")
    void createSession_usesCookieMaxAgeConfig() {
        ReflectionTestUtils.setField(controller, "cookieMaxAge", 7200);
        when(request.getHeader("Authorization")).thenReturn("Bearer t");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getMaxAge()).isEqualTo(7200);
    }

    // ─── DELETE /api/auth/session ────────────────────────────────────────

    @Test
    @DisplayName("deleteSession clears the cookie (max-age=0)")
    void deleteSession_clearsCookie() {
        ResponseEntity<Map<String, String>> result = controller.deleteSession(response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());

        Cookie cookie = cookieCaptor.getValue();
        assertThat(cookie.getName()).isEqualTo(TokenCookieFilter.COOKIE_NAME);
        assertThat(cookie.getValue()).isEmpty();
        assertThat(cookie.getMaxAge()).isZero();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Strict");

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("status", "cleared");
    }

    @Test
    @DisplayName("deleteSession in dev profile omits Secure flag on the clearing cookie")
    void deleteSession_devProfile_noSecureOnClearCookie() {
        ReflectionTestUtils.setField(controller, "activeProfile", "dev");

        controller.deleteSession(response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getSecure()).isFalse();
    }
}
