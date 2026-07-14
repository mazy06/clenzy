package com.clenzy.controller;

import com.clenzy.config.TokenCookieFilter;
import com.clenzy.service.AuthSessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link AuthSessionController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>GET /api/auth/session : 200 avec metadonnees non sensibles (JAMAIS le token brut
 *       — Z1-SEC-FRONTAUX-02) si principal JWT present, 401 sinon</li>
 *   <li>POST /api/auth/session : pose clenzy_auth (max-age cale sur l'exp du token) +,
 *       si X-Refresh-Token present, clenzy_refresh (Path=/api/auth) ; 400 si pas de header</li>
 *   <li>POST /api/auth/session/refresh : rotate les 2 cookies + metadonnees si succes,
 *       purge + 401 si refresh invalide/absent</li>
 *   <li>DELETE /api/auth/session : purge les 2 cookies (max-age=0)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class AuthSessionControllerTest {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private AuthSessionService authSessionService;

    private AuthSessionController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthSessionController(authSessionService, new ObjectMapper());
        ReflectionTestUtils.setField(controller, "secureCookie", true);
        ReflectionTestUtils.setField(controller, "activeProfile", "prod");
        ReflectionTestUtils.setField(controller, "accessCookieFallbackMaxAge", 86400);
        ReflectionTestUtils.setField(controller, "refreshCookieFallbackMaxAge", 604800);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

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

    /** Construit un JWT compact (non signe) avec les claims fournis dans le payload. */
    private static String rawJwt(long expEpoch) {
        String header = base64Url("{\"alg\":\"none\"}");
        String payload = base64Url("{\"exp\":" + expEpoch
                + ",\"sub\":\"kc-user-1\",\"preferred_username\":\"host1\""
                + ",\"email\":\"host@clenzy.fr\",\"given_name\":\"Jean\",\"family_name\":\"Dupont\""
                + ",\"realm_access\":{\"roles\":[\"HOST\"]}}");
        return header + "." + payload + ".sig";
    }

    private static String base64Url(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    /** Renvoie le fallback passe a secondsUntilExpiry (comportement pour un token non-JWT). */
    private void stubSecondsUntilExpiryReturnsFallback() {
        when(authSessionService.secondsUntilExpiry(any(), anyInt()))
                .thenAnswer(inv -> inv.getArgument(1));
    }

    // ─── GET /api/auth/session ───────────────────────────────────────────────

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

    // ─── POST /api/auth/session ──────────────────────────────────────────────

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
    @DisplayName("createSession sans X-Refresh-Token pose UNIQUEMENT clenzy_auth (HttpOnly/Secure/Strict)")
    void createSession_validBearer_setsAccessCookieOnly() {
        stubSecondsUntilExpiryReturnsFallback();
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
        // Token non-JWT → max-age = fallback (86400)
        assertThat(cookie.getMaxAge()).isEqualTo(86400);
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Strict");

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("status", "ok");
    }

    @Test
    @DisplayName("createSession avec X-Refresh-Token pose AUSSI clenzy_refresh (Path=/api/auth)")
    void createSession_withRefreshHeader_setsBothCookies() {
        stubSecondsUntilExpiryReturnsFallback();
        when(request.getHeader("Authorization")).thenReturn("Bearer access-token");
        when(request.getHeader("X-Refresh-Token")).thenReturn("refresh-token");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response, times(2)).addCookie(cookieCaptor.capture());

        List<Cookie> cookies = cookieCaptor.getAllValues();
        Cookie auth = cookies.stream().filter(c -> TokenCookieFilter.COOKIE_NAME.equals(c.getName())).findFirst().orElseThrow();
        Cookie refresh = cookies.stream().filter(c -> "clenzy_refresh".equals(c.getName())).findFirst().orElseThrow();

        assertThat(auth.getPath()).isEqualTo("/");
        assertThat(refresh.getValue()).isEqualTo("refresh-token");
        assertThat(refresh.getPath()).isEqualTo("/api/auth");
        assertThat(refresh.isHttpOnly()).isTrue();
        assertThat(refresh.getSecure()).isTrue();
        assertThat(refresh.getMaxAge()).isEqualTo(604800);
        assertThat(refresh.getAttribute("SameSite")).isEqualTo("Strict");
    }

    @Test
    @DisplayName("createSession derive le max-age du cookie sur l'exp reel du token")
    void createSession_derivesMaxAgeFromTokenExp() {
        when(authSessionService.secondsUntilExpiry(any(), anyInt())).thenReturn(3600);
        when(request.getHeader("Authorization")).thenReturn("Bearer jwt");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getMaxAge()).isEqualTo(3600);
    }

    @Test
    @DisplayName("createSession in dev profile does NOT set Secure flag")
    void createSession_devProfile_noSecureFlag() {
        stubSecondsUntilExpiryReturnsFallback();
        ReflectionTestUtils.setField(controller, "activeProfile", "dev");
        when(request.getHeader("Authorization")).thenReturn("Bearer dev-token");

        controller.createSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getValue().getSecure()).isFalse();
    }

    // ─── POST /api/auth/session/refresh ──────────────────────────────────────

    @Test
    @DisplayName("refreshSession retourne 401 quand aucun cookie clenzy_refresh")
    void refreshSession_noCookie_returns401() {
        when(request.getCookies()).thenReturn(null);

        ResponseEntity<?> result = controller.refreshSession(request, response);

        assertThat(result.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    @DisplayName("refreshSession valide rotate les 2 cookies et renvoie les metadonnees (jamais le token)")
    void refreshSession_validCookie_rotatesCookiesAndReturnsMetadata() {
        stubSecondsUntilExpiryReturnsFallback();
        long exp = Instant.now().plusSeconds(86400).getEpochSecond();
        String newAccess = rawJwt(exp);
        when(request.getCookies()).thenReturn(new Cookie[]{ new Cookie("clenzy_refresh", "old-refresh") });
        when(authSessionService.refresh("old-refresh"))
                .thenReturn(Optional.of(new AuthSessionService.RefreshedTokens(newAccess, "new-refresh")));

        ResponseEntity<?> result = controller.refreshSession(request, response);

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        AuthSessionController.SessionInfoDto body = (AuthSessionController.SessionInfoDto) result.getBody();
        assertThat(body).isNotNull();
        assertThat(body.authenticated()).isTrue();
        assertThat(body.expiresAt()).isEqualTo(exp);
        assertThat(body.subject()).isEqualTo("kc-user-1");
        assertThat(body.roles()).containsExactly("HOST");
        // Le token brut ne fuite jamais dans la reponse
        assertThat(String.valueOf(body)).doesNotContain(newAccess);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response, times(2)).addCookie(cookieCaptor.capture());
        List<Cookie> cookies = cookieCaptor.getAllValues();
        assertThat(cookies).anySatisfy(c -> {
            assertThat(c.getName()).isEqualTo(TokenCookieFilter.COOKIE_NAME);
            assertThat(c.getValue()).isEqualTo(newAccess);
        });
        assertThat(cookies).anySatisfy(c -> {
            assertThat(c.getName()).isEqualTo("clenzy_refresh");
            assertThat(c.getValue()).isEqualTo("new-refresh");
        });
    }

    @Test
    @DisplayName("refreshSession avec refresh invalide purge les cookies et repond 401")
    void refreshSession_invalidRefresh_clearsCookiesAnd401() {
        when(request.getCookies()).thenReturn(new Cookie[]{ new Cookie("clenzy_refresh", "expired") });
        when(authSessionService.refresh("expired")).thenReturn(Optional.empty());

        ResponseEntity<?> result = controller.refreshSession(request, response);

        assertThat(result.getStatusCode().value()).isEqualTo(401);
        // Purge des 2 cookies (max-age=0)
        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response, times(2)).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getAllValues()).allSatisfy(c -> assertThat(c.getMaxAge()).isZero());
    }

    // ─── DELETE /api/auth/session ────────────────────────────────────────────

    @Test
    @DisplayName("deleteSession purge les 2 cookies (max-age=0)")
    void deleteSession_clearsBothCookies() {
        ResponseEntity<Map<String, String>> result = controller.deleteSession(
                request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response, times(2)).addCookie(cookieCaptor.capture());

        List<Cookie> cookies = cookieCaptor.getAllValues();
        Cookie auth = cookies.stream().filter(c -> TokenCookieFilter.COOKIE_NAME.equals(c.getName())).findFirst().orElseThrow();
        Cookie refresh = cookies.stream().filter(c -> "clenzy_refresh".equals(c.getName())).findFirst().orElseThrow();

        assertThat(auth.getValue()).isEmpty();
        assertThat(auth.getMaxAge()).isZero();
        assertThat(auth.getPath()).isEqualTo("/");
        assertThat(refresh.getValue()).isEmpty();
        assertThat(refresh.getMaxAge()).isZero();
        assertThat(refresh.getPath()).isEqualTo("/api/auth");

        assertThat(result.getStatusCode().value()).isEqualTo(200);
        assertThat(result.getBody()).containsEntry("status", "cleared");
    }

    @Test
    @DisplayName("deleteSession in dev profile omits Secure flag on the clearing cookies")
    void deleteSession_devProfile_noSecureOnClearCookie() {
        ReflectionTestUtils.setField(controller, "activeProfile", "dev");

        controller.deleteSession(request, response);

        ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
        verify(response, times(2)).addCookie(cookieCaptor.capture());
        assertThat(cookieCaptor.getAllValues()).allSatisfy(c -> assertThat(c.getSecure()).isFalse());
    }
}
