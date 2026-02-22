package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link SecurityAuditAccessDeniedHandler}.
 * Validates 403 response, JWT actor extraction, and security audit logging.
 */
@ExtendWith(MockitoExtension.class)
class SecurityAuditAccessDeniedHandlerTest {

    @Mock
    private SecurityAuditService securityAuditService;

    private SecurityAuditAccessDeniedHandler handler;

    @BeforeEach
    void setUp() {
        handler = new SecurityAuditAccessDeniedHandler(securityAuditService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("When authenticated user denied, returns 403 with actor info logged")
    void whenAuthenticatedUserDenied_thenLogs403WithActorInfo() throws Exception {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-456")
                .claim("email", "admin@clenzy.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(jwt);
        SecurityContextHolder.getContext().setAuthentication(auth);

        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/admin/users/1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException ex = new AccessDeniedException("Access denied");

        handler.handle(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString()).contains("Acces refuse");
        assertThat(response.getContentAsString()).contains("403");
        verify(securityAuditService).logPermissionDenied(
                "user-456", "admin@clenzy.com", "ENDPOINT",
                "/api/admin/users/1", "DELETE /api/admin/users/1");
    }

    @Test
    @DisplayName("When unauthenticated user denied, logs with null actor")
    void whenNoAuthentication_thenLogsWithNullActor() throws Exception {
        SecurityContextHolder.clearContext();

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/protected");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException ex = new AccessDeniedException("Forbidden");

        handler.handle(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(403);
        verify(securityAuditService).logPermissionDenied(
                null, null, "ENDPOINT", "/api/protected", "POST /api/protected");
    }

    @Test
    @DisplayName("When security context extraction fails, still returns 403")
    void whenSecurityContextFails_thenStillReturns403() throws Exception {
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenThrow(new RuntimeException("Bad principal"));
        SecurityContextHolder.getContext().setAuthentication(auth);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException ex = new AccessDeniedException("Denied");

        handler.handle(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(403);
        verify(securityAuditService).logPermissionDenied(
                null, null, "ENDPOINT", "/api/secret", "GET /api/secret");
    }
}
