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
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link AuthSessionController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>GET /api/auth/session : 200 avec token si header Authorization Bearer, 401 sinon</li>
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

    @Test
    @DisplayName("getSession returns token from Authorization header when Bearer present")
    void getSession_validBearer_returnsToken() {
        when(request.getHeader("Authorization")).thenReturn("Bearer my-jwt-token");

        ResponseEntity<Map<String, String>> response = controller.getSession(request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("token", "my-jwt-token");
    }

    @Test
    @DisplayName("getSession returns 401 when Authorization header missing")
    void getSession_noHeader_returns401() {
        when(request.getHeader("Authorization")).thenReturn(null);

        ResponseEntity<Map<String, String>> response = controller.getSession(request);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).containsKey("error");
    }

    @Test
    @DisplayName("getSession returns 401 when Authorization is Basic (not Bearer)")
    void getSession_basicAuth_returns401() {
        when(request.getHeader("Authorization")).thenReturn("Basic dXNlcjpwYXNz");

        ResponseEntity<Map<String, String>> response = controller.getSession(request);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    @DisplayName("getSession strips 'Bearer ' prefix exactly (7 chars)")
    void getSession_stripsBearerPrefix() {
        when(request.getHeader("Authorization")).thenReturn("Bearer    spaces-token");

        ResponseEntity<Map<String, String>> response = controller.getSession(request);

        // Note: only the literal "Bearer " (7 chars) is stripped — spaces stay
        assertThat(response.getBody()).containsEntry("token", "   spaces-token");
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
