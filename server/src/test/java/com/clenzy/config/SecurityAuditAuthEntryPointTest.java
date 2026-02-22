package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Tests for {@link SecurityAuditAuthEntryPoint}.
 * Validates 401 response and security audit logging for unauthenticated access.
 */
@ExtendWith(MockitoExtension.class)
class SecurityAuditAuthEntryPointTest {

    @Mock
    private SecurityAuditService securityAuditService;

    private SecurityAuditAuthEntryPoint entryPoint;

    @BeforeEach
    void setUp() {
        entryPoint = new SecurityAuditAuthEntryPoint(securityAuditService);
    }

    @Test
    @DisplayName("When unauthenticated access, returns 401 JSON and logs")
    void whenUnauthenticatedAccess_thenReturns401AndLogs() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/properties");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException ex = new BadCredentialsException("Token expired");

        entryPoint.commence(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString()).contains("Non authentifie");
        assertThat(response.getContentAsString()).contains("JWT manquant ou invalide");
        assertThat(response.getContentAsString()).contains("401");
        verify(securityAuditService).logLoginFailure(null,
                "Unauthenticated access: GET /api/properties");
    }

    @Test
    @DisplayName("When POST unauthenticated, logs correct method and path")
    void whenPostUnauthenticated_thenLogsCorrectMethodPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/interventions");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException ex = new BadCredentialsException("Missing JWT");

        entryPoint.commence(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(securityAuditService).logLoginFailure(null,
                "Unauthenticated access: POST /api/interventions");
    }

    @Test
    @DisplayName("When DELETE unauthenticated, logs correct method")
    void whenDeleteUnauthenticated_thenLogsCorrectMethod() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/users/1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException ex = new BadCredentialsException("No token");

        entryPoint.commence(request, response, ex);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(securityAuditService).logLoginFailure(null,
                "Unauthenticated access: DELETE /api/users/1");
    }
}
