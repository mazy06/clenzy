package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import com.clenzy.tenant.TenantFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Exercises the production security DSL, including the real cookie and bearer filters.
 * Guards the non-reachability assessment for CVE-2026-41707: Baitly does not
 * authenticate DPoP proofs. Reassess the OWASP exception before enabling DPoP.
 */
@SpringJUnitWebConfig(BaitlyBearerAuthenticationTest.Config.class)
class BaitlyBearerAuthenticationTest {

    @Autowired
    private SecurityFilterChain securityFilterChain;

    @Autowired
    private JwtDecoder jwtDecoder;

    @BeforeEach
    void resetDecoder() {
        reset(jwtDecoder);
        when(jwtDecoder.decode("valid-token")).thenReturn(Jwt.withTokenValue("valid-token")
                .header("alg", "RS256")
                .subject("host-id")
                .claim("realm_access", Map.of("roles", List.of("HOST")))
                .build());
    }

    @Test
    void bearerTokenAuthenticatesWithTheProductionRoleConverter() throws Exception {
        var request = protectedRequest();
        request.addHeader("Authorization", "Bearer valid-token");

        assertThat(execute(request).getStatus()).isEqualTo(200);
        verify(jwtDecoder).decode("valid-token");
    }

    @Test
    void httpOnlyCookieStillAuthenticatesAsBearer() throws Exception {
        var request = protectedRequest();
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, "valid-token"));

        assertThat(execute(request).getStatus()).isEqualTo(200);
        verify(jwtDecoder).decode("valid-token");
    }

    @ParameterizedTest
    @ValueSource(strings = {"DPoP", "dpop", "DPOP"})
    void dpopAuthorizationCannotAuthenticate(String scheme) throws Exception {
        var request = protectedRequest();
        request.addHeader("Authorization", scheme + " valid-token");
        request.addHeader("DPoP", "proof-does-not-enable-dpop");

        assertThat(execute(request).getStatus()).isEqualTo(401);
        verifyNoInteractions(jwtDecoder);
    }

    @ParameterizedTest
    @CsvSource({"GET, /api/auth/session", "POST, /api/auth/login", "POST, /api/booking-engine/auth/login"})
    void dpopIsAlsoBlockedBeforeThePublicAuthRouteBypass(String method, String path) throws Exception {
        var request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        request.addHeader("Authorization", "DPoP valid-token");
        request.addHeader("DPoP", "proof-does-not-enable-dpop");

        var response = execute(request);
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
        verifyNoInteractions(jwtDecoder);
    }

    @Test
    void dpopBoundTokensCannotBeDowngradedToBearer() throws Exception {
        when(jwtDecoder.decode("bound-token")).thenReturn(Jwt.withTokenValue("bound-token")
                .header("alg", "RS256")
                .subject("host-id")
                .claim("realm_access", Map.of("roles", List.of("HOST")))
                .claim("cnf", Map.of("jkt", "proof-key-thumbprint"))
                .build());
        var request = protectedRequest();
        request.addHeader("Authorization", "Bearer bound-token");

        assertThat(execute(request).getStatus()).isEqualTo(401);
    }

    @Test
    void dpopAuthorizationCannotFallBackToAnAuthenticationCookie() throws Exception {
        var request = protectedRequest();
        request.addHeader("Authorization", "DPoP valid-token");
        request.addHeader("DPoP", "proof-does-not-enable-dpop");
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, "valid-token"));

        assertThat(execute(request).getStatus()).isEqualTo(401);
        verifyNoInteractions(jwtDecoder);
    }

    @Test
    void aDpopProofAloneCannotAuthenticate() throws Exception {
        var request = protectedRequest();
        request.addHeader("DPoP", "proof-does-not-enable-dpop");

        assertThat(execute(request).getStatus()).isEqualTo(401);
        verifyNoInteractions(jwtDecoder);
    }

    @Test
    void invalidBearerTokenIsRejected() throws Exception {
        when(jwtDecoder.decode("invalid-token")).thenThrow(new BadJwtException("Invalid test token"));
        var request = protectedRequest();
        request.addHeader("Authorization", "Bearer invalid-token");

        assertThat(execute(request).getStatus()).isEqualTo(401);
    }

    private MockHttpServletRequest protectedRequest() {
        var request = new MockHttpServletRequest("GET", "/api/properties");
        request.setServletPath("/api/properties");
        return request;
    }

    private MockHttpServletResponse execute(MockHttpServletRequest request) throws Exception {
        var response = new MockHttpServletResponse();
        new FilterChainProxy(securityFilterChain).doFilter(request, response, (req, res) -> {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertThat(authentication).isNotNull();
            assertThat(authentication.getName()).isEqualTo("host-id");
            assertThat(authentication.getAuthorities()).extracting("authority").contains("ROLE_HOST");
            response.setStatus(200);
        });
        return response;
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebSecurity
    @EnableWebMvc
    static class Config {

        @Bean
        JwtDecoder jwtDecoder() {
            return mock(JwtDecoder.class);
        }

        @Bean
        SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
            var productionConfig = new SecurityConfigProd();
            ReflectionTestUtils.setField(productionConfig, "allowedOrigins", "https://app.baitly.fr");
            var tenantFilter = mock(TenantFilter.class);
            // Tenant persistence is outside this test; forward requests without skipping security.
            doAnswer(invocation -> {
                FilterChain chain = invocation.getArgument(2);
                chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
                return null;
            }).when(tenantFilter).doFilter(any(), any(), any());
            var auditService = mock(SecurityAuditService.class);
            return productionConfig.securityFilterChain(http, tenantFilter, new TokenCookieFilter(),
                    new SecurityAuditAccessDeniedHandler(auditService),
                    new SecurityAuditAuthEntryPoint(auditService));
        }
    }
}
