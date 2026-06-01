package com.clenzy.config;

import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantFilter;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.DefaultSecurityFilterChain;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Tests unitaires pour {@link SecurityConfig} (profile dev/non-prod).
 *
 * <p>Suit le meme pattern que {@link SecurityConfigProdTest} : on instancie
 * la classe directement, on appelle chaque @Bean et on verifie le comportement.
 * Pour les methodes privees (keycloakRoleConverter, extractRealmRoles), on passe
 * par reflection.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SecurityConfig (dev)")
class SecurityConfigTest {

    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private FiscalProfileRepository fiscalProfileRepository;
    @Mock private EntityManager entityManager;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private TenantContext tenantContext;

    private SecurityConfig config;

    @BeforeEach
    void setUp() {
        config = new SecurityConfig();
    }

    // ─── tenantFilter ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("tenantFilter / tenantFilterRegistration")
    class TenantFilterBeans {
        @Test
        @DisplayName("creates a TenantFilter from injected deps")
        void tenantFilter_isCreated() {
            TenantFilter filter = config.tenantFilter(userRepository, organizationRepository,
                fiscalProfileRepository, entityManager, redisTemplate, tenantContext);
            assertThat(filter).isNotNull();
        }

        @Test
        @DisplayName("registration bean is disabled (filter chain only)")
        void tenantFilterRegistration_isDisabled() {
            TenantFilter filter = config.tenantFilter(userRepository, organizationRepository,
                fiscalProfileRepository, entityManager, redisTemplate, tenantContext);
            FilterRegistrationBean<TenantFilter> registration = config.tenantFilterRegistration(filter);

            assertThat(registration).isNotNull();
            assertThat(registration.isEnabled()).isFalse();
            assertThat(registration.getFilter()).isSameAs(filter);
        }
    }

    // ─── tokenCookieFilter ────────────────────────────────────────────────────

    @Nested
    @DisplayName("tokenCookieFilter / tokenCookieFilterRegistration")
    class TokenCookieFilterBeans {
        @Test
        @DisplayName("creates a TokenCookieFilter instance")
        void tokenCookieFilter_isCreated() {
            TokenCookieFilter filter = config.tokenCookieFilter();
            assertThat(filter).isNotNull();
        }

        @Test
        @DisplayName("registration bean is disabled")
        void tokenCookieFilterRegistration_isDisabled() {
            TokenCookieFilter filter = config.tokenCookieFilter();
            FilterRegistrationBean<TokenCookieFilter> registration =
                config.tokenCookieFilterRegistration(filter);

            assertThat(registration).isNotNull();
            assertThat(registration.isEnabled()).isFalse();
            assertThat(registration.getFilter()).isSameAs(filter);
        }
    }

    // ─── jwtDecoder ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("jwtDecoder")
    class JwtDecoderBean {
        @Test
        @DisplayName("builds a NimbusJwtDecoder for the given JWK set URI")
        void jwtDecoder_isCreated() {
            JwtDecoder decoder = config.jwtDecoder("https://keycloak.local/realms/clenzy/protocol/openid-connect/certs");
            assertThat(decoder).isNotNull();
        }
    }

    // ─── corsConfigurationSource ──────────────────────────────────────────────

    @Nested
    @DisplayName("corsConfigurationSource")
    class CorsConfigSource {
        @Test
        @DisplayName("returns an UrlBasedCorsConfigurationSource with localhost origins for admin path")
        void corsConfigurationSource_adminPath() {
            CorsConfigurationSource source = config.corsConfigurationSource();

            assertThat(source).isInstanceOf(UrlBasedCorsConfigurationSource.class);

            HttpServletRequest req = mockRequest("/api/users/me");
            CorsConfiguration cfg = source.getCorsConfiguration(req);
            assertThat(cfg).isNotNull();
            assertThat(cfg.getAllowCredentials()).isTrue();
            assertThat(cfg.getAllowedOrigins()).contains(
                "http://localhost:3000", "http://localhost:3001",
                "http://localhost:8080", "http://localhost:5173", "http://localhost:5174",
                "http://localhost:4173");
            assertThat(cfg.getAllowedMethods()).contains(
                "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS");
            assertThat(cfg.getMaxAge()).isEqualTo(3600L);
            assertThat(cfg.getExposedHeaders()).contains(
                "X-Organization-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining",
                "Retry-After", "X-Request-Id", "X-Response-Time");
        }

        @Test
        @DisplayName("booking public path gets the dynamic allowedOriginPatterns config")
        void corsConfigurationSource_bookingPath() {
            CorsConfigurationSource source = config.corsConfigurationSource();

            HttpServletRequest req = mockRequest("/api/public/booking/search");
            CorsConfiguration cfg = source.getCorsConfiguration(req);
            assertThat(cfg).isNotNull();
            assertThat(cfg.getAllowCredentials()).isFalse();
            assertThat(cfg.getAllowedOriginPatterns()).contains("*");
            assertThat(cfg.getAllowedHeaders()).contains("Content-Type", "X-Booking-Key");
            assertThat(cfg.getAllowedMethods()).contains("GET", "POST", "OPTIONS");
            assertThat(cfg.getAllowedMethods()).doesNotContain("DELETE", "PUT");
            assertThat(cfg.getMaxAge()).isEqualTo(3600L);
        }

        private HttpServletRequest mockRequest(String path) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            req.setServletPath(path);
            return req;
        }
    }

    // ─── keycloakRoleConverter (private) ──────────────────────────────────────

    @Nested
    @DisplayName("keycloakRoleConverter (private)")
    class KeycloakRoleConverterTest {

        @Test
        @DisplayName("realm_access roles -> ROLE_*")
        void realmRoles_areConverted() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("HOST", "TECHNICIAN"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(auth).isNotNull();
            assertThat(authorityNames(auth.getAuthorities()))
                .contains("ROLE_HOST", "ROLE_TECHNICIAN");
        }

        @Test
        @DisplayName("legacy ADMIN role -> SUPER_ADMIN (compat)")
        void legacyAdminRole_isNormalized() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("admin"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).contains("ROLE_SUPER_ADMIN");
            assertThat(authorityNames(auth.getAuthorities())).doesNotContain("ROLE_ADMIN");
        }

        @Test
        @DisplayName("legacy MANAGER role -> SUPER_MANAGER")
        void legacyManagerRole_isNormalized() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("manager"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).contains("ROLE_SUPER_MANAGER");
            assertThat(authorityNames(auth.getAuthorities())).doesNotContain("ROLE_MANAGER");
        }

        @Test
        @DisplayName("no realm_access -> only scope authorities")
        void noRealmAccess_returnsScopesOnly() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("scope", "openid profile"));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .contains("ROLE_openid", "ROLE_profile");
        }

        @Test
        @DisplayName("realm_access non-list -> empty")
        void realmRolesNotList_returnsEmpty() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", "HOST")));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).isEmpty();
        }

        @Test
        @DisplayName("non-string items are silently skipped")
        void nonStringItems_areSkipped() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access",
                Map.of("roles", List.of("HOST", 123, true, "TECHNICIAN"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .containsExactlyInAnyOrder("ROLE_HOST", "ROLE_TECHNICIAN");
        }

        @Test
        @DisplayName("mixed scope + realm -> merged authorities")
        void mixedScopeAndRealm() {
            JwtAuthenticationConverter converter = invokeConverter();
            Map<String, Object> claims = new HashMap<>();
            claims.put("scope", "openid email");
            claims.put("realm_access", Map.of("roles", List.of("HOST")));
            Jwt jwt = jwt(claims);

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .contains("ROLE_HOST", "ROLE_openid", "ROLE_email");
        }

        private JwtAuthenticationConverter invokeConverter() {
            try {
                Method m = SecurityConfig.class.getDeclaredMethod("keycloakRoleConverter");
                m.setAccessible(true);
                return (JwtAuthenticationConverter) m.invoke(config);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        private Jwt jwt(Map<String, Object> claims) {
            return new Jwt(
                "test-token-value",
                Instant.now(),
                Instant.now().plusSeconds(60),
                Map.of("alg", "RS256"),
                claims
            );
        }

        private Set<String> authorityNames(java.util.Collection<? extends GrantedAuthority> a) {
            return a.stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
        }
    }

    // ─── securityFilterChain DSL coverage ────────────────────────────────────

    @Nested
    @DisplayName("securityFilterChain")
    class SecurityFilterChainConfig {

        @Test
        @DisplayName("calls all DSL methods and returns built chain")
        void securityFilterChain_callsAllDsl() throws Exception {
            HttpSecurity http = mock(HttpSecurity.class);
            TenantFilter tenantFilter = mock(TenantFilter.class);
            TokenCookieFilter tokenCookieFilter = mock(TokenCookieFilter.class);

            lenient().when(http.csrf(any())).thenReturn(http);
            lenient().when(http.cors(any())).thenReturn(http);
            lenient().when(http.headers(any())).thenReturn(http);
            lenient().when(http.authorizeHttpRequests(any())).thenReturn(http);
            lenient().when(http.oauth2ResourceServer(any())).thenReturn(http);
            lenient().when(http.addFilterBefore(any(), any())).thenReturn(http);
            lenient().when(http.addFilterAfter(any(), any())).thenReturn(http);
            lenient().when(http.httpBasic(any())).thenReturn(http);

            DefaultSecurityFilterChain expected = mock(DefaultSecurityFilterChain.class);
            org.mockito.Mockito.doReturn(expected).when(http).build();

            SecurityFilterChain chain = config.securityFilterChain(http, tenantFilter, tokenCookieFilter);

            assertThat(chain).isSameAs(expected);

            verify(http).csrf(any());
            verify(http).cors(any());
            verify(http).headers(any());
            verify(http).authorizeHttpRequests(any());
            verify(http).oauth2ResourceServer(any());
            verify(http).addFilterBefore(any(), any());
            verify(http).addFilterAfter(any(), any());
            verify(http).httpBasic(any());
            verify(http).build();
        }
    }
}
