package com.clenzy.config;

import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantFilter;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link SecurityConfigProd}.
 *
 * <p>On instancie directement la classe (sans Spring) puis on appelle chaque
 * methode bean publique pour verifier la configuration produite. Pour les
 * methodes privees (keycloakRoleConverter, extractRealmRoles, etc.) on passe
 * par {@link ReflectionTestUtils}.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SecurityConfigProd")
class SecurityConfigProdTest {

    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private FiscalProfileRepository fiscalProfileRepository;
    @Mock private EntityManager entityManager;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private TenantContext tenantContext;

    private SecurityConfigProd config;

    @BeforeEach
    void setUp() {
        config = new SecurityConfigProd();
        // Default origins (matches the @Value default in production)
        ReflectionTestUtils.setField(config, "allowedOrigins",
            "https://app.clenzy.fr,https://clenzy.fr,https://www.clenzy.fr");
    }

    // ─── tenantFilter bean ────────────────────────────────────────────────

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
        @DisplayName("registration bean is disabled (filter chain only registration)")
        void tenantFilterRegistration_isDisabled() {
            TenantFilter filter = config.tenantFilter(userRepository, organizationRepository,
                fiscalProfileRepository, entityManager, redisTemplate, tenantContext);
            FilterRegistrationBean<TenantFilter> registration = config.tenantFilterRegistration(filter);

            assertThat(registration).isNotNull();
            assertThat(registration.isEnabled()).isFalse();
            assertThat(registration.getFilter()).isSameAs(filter);
        }
    }

    // ─── tokenCookieFilter bean ───────────────────────────────────────────

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
        @DisplayName("registration bean is disabled (filter chain only registration)")
        void tokenCookieFilterRegistration_isDisabled() {
            TokenCookieFilter filter = config.tokenCookieFilter();
            FilterRegistrationBean<TokenCookieFilter> registration =
                config.tokenCookieFilterRegistration(filter);

            assertThat(registration).isNotNull();
            assertThat(registration.isEnabled()).isFalse();
            assertThat(registration.getFilter()).isSameAs(filter);
        }
    }

    // ─── corsConfigurationSource bean ─────────────────────────────────────

    @Nested
    @DisplayName("corsConfigurationSource")
    class CorsConfigSource {

        @Test
        @DisplayName("returns an UrlBasedCorsConfigurationSource configured for booking-public + admin paths")
        void corsConfigurationSource_isConfigured() {
            CorsConfigurationSource source = config.corsConfigurationSource();

            assertThat(source).isInstanceOf(UrlBasedCorsConfigurationSource.class);

            // Default admin config: applied on a random API path
            HttpServletRequest adminReq = mockRequest("/api/users/me");
            CorsConfiguration adminConfig = source.getCorsConfiguration(adminReq);
            assertThat(adminConfig).isNotNull();
            assertThat(adminConfig.getAllowCredentials()).isTrue();
            assertThat(adminConfig.getAllowedOrigins()).contains(
                "https://app.clenzy.fr", "https://clenzy.fr", "https://www.clenzy.fr");
            assertThat(adminConfig.getAllowedMethods()).contains(
                "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS");
            assertThat(adminConfig.getMaxAge()).isEqualTo(3600L);
            assertThat(adminConfig.getExposedHeaders()).contains(
                "Authorization", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining",
                "Retry-After", "X-Request-Id", "X-Response-Time", "X-Organization-Id");

            // Booking public config: applied on /api/public/booking/**
            HttpServletRequest bookingReq = mockRequest("/api/public/booking/search");
            CorsConfiguration bookingConfig = source.getCorsConfiguration(bookingReq);
            assertThat(bookingConfig).isNotNull();
            assertThat(bookingConfig.getAllowCredentials()).isFalse();
            assertThat(bookingConfig.getAllowedOriginPatterns()).contains("*");
            assertThat(bookingConfig.getAllowedHeaders()).contains("Content-Type", "X-Booking-Key");
            assertThat(bookingConfig.getAllowedMethods()).contains("GET", "POST", "OPTIONS");
            assertThat(bookingConfig.getAllowedMethods()).doesNotContain("DELETE", "PUT");
        }

        @Test
        @DisplayName("custom allowed-origins property is split by comma")
        void corsConfigurationSource_customOrigins() {
            ReflectionTestUtils.setField(config, "allowedOrigins",
                "https://a.example.com,https://b.example.com");

            CorsConfigurationSource source = config.corsConfigurationSource();
            HttpServletRequest req = mockRequest("/api/admin/users");
            CorsConfiguration cfg = source.getCorsConfiguration(req);

            assertThat(cfg).isNotNull();
            assertThat(cfg.getAllowedOrigins())
                .containsExactly("https://a.example.com", "https://b.example.com");
        }

        @Test
        @DisplayName("single origin is parsed properly (no trailing whitespace)")
        void corsConfigurationSource_singleOrigin() {
            ReflectionTestUtils.setField(config, "allowedOrigins", "https://only.example.com");

            CorsConfigurationSource source = config.corsConfigurationSource();
            HttpServletRequest req = mockRequest("/api/x");
            CorsConfiguration cfg = source.getCorsConfiguration(req);

            assertThat(cfg.getAllowedOrigins()).containsExactly("https://only.example.com");
        }

        /**
         * Spring's UrlBasedCorsConfigurationSource calls UrlPathHelper.getLookupPathForRequest(req),
         * which depends on HttpServletMapping (Servlet 4.0+). MockHttpServletRequest from spring-test
         * provides a valid mapping by default.
         */
        private HttpServletRequest mockRequest(String path) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            req.setServletPath(path);
            return req;
        }
    }

    // ─── corsFilter bean ──────────────────────────────────────────────────

    @Nested
    @DisplayName("corsFilter / corsFilterRegistration")
    class CorsFilterBean {

        @Test
        @DisplayName("creates a CorsFilter (Spring MVC filter)")
        void corsFilter_isCreated() {
            CorsFilter filter = config.corsFilter();
            assertThat(filter).isNotNull();
        }

        @Test
        @DisplayName("registration runs with highest precedence (CORS preflight before everything)")
        void corsFilterRegistration_highPrecedence() {
            CorsFilter filter = config.corsFilter();
            FilterRegistrationBean<CorsFilter> registration = config.corsFilterRegistration(filter);

            assertThat(registration.getFilter()).isSameAs(filter);
            assertThat(registration.getOrder()).isEqualTo(Ordered.HIGHEST_PRECEDENCE);
        }
    }

    // ─── webMvcConfigurer ─────────────────────────────────────────────────

    @Nested
    @DisplayName("webMvcConfigurer")
    class WebMvcConfigurerBean {

        @Test
        @DisplayName("adds CORS mappings to the registry")
        @SuppressWarnings("unchecked")
        void webMvcConfigurer_addsMappings() throws Exception {
            WebMvcConfigurer cfg = config.webMvcConfigurer();
            assertThat(cfg).isNotNull();

            // Manual exercise of the customizer using a real CorsRegistry
            CorsRegistry registry = new CorsRegistry();
            cfg.addCorsMappings(registry);

            // getCorsConfigurations() is protected on CorsRegistry — invoke via reflection.
            Method getter = CorsRegistry.class.getDeclaredMethod("getCorsConfigurations");
            getter.setAccessible(true);
            Map<String, CorsConfiguration> map = (Map<String, CorsConfiguration>) getter.invoke(registry);

            assertThat(map).containsKey("/**");
            CorsConfiguration c = map.get("/**");
            assertThat(c.getAllowedOrigins()).contains(
                "https://app.clenzy.fr", "https://clenzy.fr", "https://www.clenzy.fr");
            assertThat(c.getAllowedMethods()).contains("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS");
            assertThat(c.getAllowCredentials()).isTrue();
            assertThat(c.getMaxAge()).isEqualTo(3600L);
        }
    }

    // ─── keycloakRoleConverter (private) ──────────────────────────────────

    @Nested
    @DisplayName("keycloakRoleConverter (private bean returned via @Bean securityFilterChain)")
    class KeycloakRoleConverter {

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
        @DisplayName("legacy ADMIN role -> SUPER_ADMIN (compat safety net)")
        void legacyAdminRole_isNormalized() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("admin"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).contains("ROLE_SUPER_ADMIN");
            assertThat(authorityNames(auth.getAuthorities())).doesNotContain("ROLE_ADMIN");
        }

        @Test
        @DisplayName("legacy MANAGER role -> SUPER_MANAGER (compat safety net)")
        void legacyManagerRole_isNormalized() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("manager"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).contains("ROLE_SUPER_MANAGER");
            assertThat(authorityNames(auth.getAuthorities())).doesNotContain("ROLE_MANAGER");
        }

        @Test
        @DisplayName("missing realm_access -> only scope authorities")
        void noRealmAccess_returnsScopesOnly() {
            JwtAuthenticationConverter converter = invokeConverter();
            // No realm_access; an explicit scope claim still yields the ROLE_scope.
            Jwt jwt = jwt(Map.of("scope", "openid profile"));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .contains("ROLE_openid", "ROLE_profile");
        }

        @Test
        @DisplayName("realm_access without 'roles' key returns empty list")
        void realmAccessWithoutRoles_returnsEmpty() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("other_key", "foo")));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            // No realm roles, no scopes claimed
            assertThat(authorityNames(auth.getAuthorities())).isEmpty();
        }

        @Test
        @DisplayName("realm roles with non-string items are skipped silently")
        void nonStringRealmRoles_areSkipped() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access",
                Map.of("roles", List.of("HOST", 123, true, "TECHNICIAN"))));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .containsExactlyInAnyOrder("ROLE_HOST", "ROLE_TECHNICIAN");
        }

        @Test
        @DisplayName("realm_access.roles non-list -> empty")
        void realmRolesNotList_returnsEmpty() {
            JwtAuthenticationConverter converter = invokeConverter();
            Jwt jwt = jwt(Map.of("realm_access", Map.of("roles", "HOST")));

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities())).isEmpty();
        }

        @Test
        @DisplayName("mixed scope + realm roles -> all granted authorities")
        void mixedScopeAndRealmRoles_areMerged() {
            JwtAuthenticationConverter converter = invokeConverter();
            Map<String, Object> claims = new HashMap<>();
            claims.put("scope", "openid email");
            claims.put("realm_access", Map.of("roles", List.of("HOST")));
            Jwt jwt = jwt(claims);

            AbstractAuthenticationToken auth = converter.convert(jwt);
            assertThat(authorityNames(auth.getAuthorities()))
                .contains("ROLE_HOST", "ROLE_openid", "ROLE_email");
        }

        // Helpers --------------------------------------------------------

        private JwtAuthenticationConverter invokeConverter() {
            try {
                Method m = SecurityConfigProd.class.getDeclaredMethod("keycloakRoleConverter");
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

    // ─── extractClientRoles (private, currently unused) ───────────────────

    @Nested
    @DisplayName("extractClientRoles (private helper)")
    class ExtractClientRoles {

        @Test
        @DisplayName("missing resource_access -> empty")
        void noResourceAccess_returnsEmpty() {
            // Jwt requires at least one claim; provide an unrelated one
            @SuppressWarnings("unchecked")
            java.util.Collection<GrantedAuthority> result =
                (java.util.Collection<GrantedAuthority>) invoke(
                    jwt(Map.of("sub", "user-1")), "any-client");
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("client not present in resource_access -> empty")
        void clientMissing_returnsEmpty() {
            Map<String, Object> resAccess = Map.of("other-client", Map.of("roles", List.of("X")));
            @SuppressWarnings("unchecked")
            java.util.Collection<GrantedAuthority> result =
                (java.util.Collection<GrantedAuthority>) invoke(
                    jwt(Map.of("resource_access", resAccess)), "my-client");
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("client roles -> ROLE_UPPERCASE")
        void clientRoles_areConverted() {
            Map<String, Object> resAccess = Map.of("my-client",
                Map.of("roles", List.of("admin", "user", 42)));
            @SuppressWarnings("unchecked")
            java.util.Collection<GrantedAuthority> result =
                (java.util.Collection<GrantedAuthority>) invoke(
                    jwt(Map.of("resource_access", resAccess)), "my-client");

            assertThat(result.stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet()))
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_USER");
        }

        @Test
        @DisplayName("client roles non-list -> empty")
        void clientRolesNotList_returnsEmpty() {
            Map<String, Object> resAccess = Map.of("my-client", Map.of("roles", "admin"));
            @SuppressWarnings("unchecked")
            java.util.Collection<GrantedAuthority> result =
                (java.util.Collection<GrantedAuthority>) invoke(
                    jwt(Map.of("resource_access", resAccess)), "my-client");
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("client value not a map -> empty")
        void clientNotMap_returnsEmpty() {
            Map<String, Object> resAccess = Map.of("my-client", "value-not-a-map");
            @SuppressWarnings("unchecked")
            java.util.Collection<GrantedAuthority> result =
                (java.util.Collection<GrantedAuthority>) invoke(
                    jwt(Map.of("resource_access", resAccess)), "my-client");
            assertThat(result).isEmpty();
        }

        private Object invoke(Jwt jwt, String clientId) {
            try {
                Method m = SecurityConfigProd.class.getDeclaredMethod(
                    "extractClientRoles", Jwt.class, String.class);
                m.setAccessible(true);
                return m.invoke(config, jwt, clientId);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        private Jwt jwt(Map<String, Object> claims) {
            return new Jwt(
                "token",
                Instant.now(),
                Instant.now().plusSeconds(60),
                Map.of("alg", "RS256"),
                claims
            );
        }
    }
}
