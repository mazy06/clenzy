package com.clenzy.config;

import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantFilter;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Profile("!prod")
public class SecurityConfig {

    /**
     * Cree le TenantFilter comme @Bean Spring.
     * IMPORTANT : doit etre accompagne du FilterRegistrationBean ci-dessous
     * pour empecher Spring Boot de l'enregistrer automatiquement comme servlet filter.
     * Le TenantFilter doit UNIQUEMENT s'executer dans la security chain
     * (via addFilterAfter) pour avoir acces au JWT authentifie.
     */
    @Bean
    public TenantFilter tenantFilter(UserRepository userRepository,
                                      OrganizationRepository organizationRepository,
                                      EntityManager entityManager,
                                      RedisTemplate<String, Object> redisTemplate,
                                      TenantContext tenantContext) {
        return new TenantFilter(userRepository, organizationRepository, entityManager, redisTemplate, tenantContext);
    }

    /**
     * Desactive l'auto-enregistrement du TenantFilter comme servlet filter.
     * Spring Boot enregistre automatiquement tous les beans Filter comme servlet filters.
     * Sans cela, le TenantFilter s'execute AVANT Spring Security (pas d'auth JWT)
     * et OncePerRequestFilter bloque la deuxieme execution dans la security chain.
     */
    @Bean
    public FilterRegistrationBean<TenantFilter> tenantFilterRegistration(TenantFilter tenantFilter) {
        FilterRegistrationBean<TenantFilter> registration = new FilterRegistrationBean<>(tenantFilter);
        registration.setEnabled(false);
        return registration;
    }

    /**
     * JwtDecoder custom pour l'environnement dev/Docker.
     * Valide la signature JWT via JWK Set (sécurisé) + timestamps,
     * mais n'impose PAS de validation d'issuer.
     * Nécessaire car en dev les clients accèdent à Keycloak via des URLs différentes :
     *   - Web : http://localhost:8086 → iss = http://localhost:8086/realms/clenzy
     *   - Mobile : http://192.168.1.70:8086 → iss = http://192.168.1.70:8086/realms/clenzy
     *   - Backend Docker : http://clenzy-keycloak:8080
     * La prod utilise SecurityConfigProd avec validation d'issuer stricte.
     */
    @Bean
    @ConditionalOnMissingBean(JwtDecoder.class)
    @ConditionalOnProperty(name = "spring.security.oauth2.resourceserver.jwt.jwk-set-uri")
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator()
        ));
        return decoder;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, TenantFilter tenantFilter) throws Exception {
        http
            // CSRF disabled: architecture JWT stateless sans cookies de session (voir SecurityConfigProd)
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
                .contentTypeOptions(Customizer.withDefaults())                    // X-Content-Type-Options: nosniff
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                )
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
                .permissionsPolicy(permissions -> permissions
                    .policy("camera=(), microphone=(), geolocation=(), payment=()")
                )
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/actuator/**",
                    "/v3/api-docs/**",
                    "/swagger-ui.html",
                    "/swagger-ui/**",
                    "/h2-console/**",
                    "/api/auth/**",
                    "/api/permissions/**",
                    "/api/health",
                    "/api/me",
                    "/api/managers/all",
                    "/api/managers/hosts",
                    "/api/managers/operational-users",
                    "/api/managers/teams",
                    "/api/managers/properties/by-clients",
                    "/api/managers/*/associations",
                    "/api/managers/*/assign",
                    "/api/managers/*/assign-teams-users",
                    "/api/managers/*/reassign",
                    "/api/managers/*/clients/*",
                    "/api/managers/*/teams/*",
                    "/api/managers/*/users/*",
                    "/api/managers/*/properties/*",
                    "/api/portfolios/**",
                    "/api/property-teams/**",
                    "/api/properties/with-managers",
                    "/api/sync/**",
                    "/api/webhooks/stripe",
                    "/api/webhooks/airbnb",
                    "/api/webhooks/minut",
                    "/api/webhooks/tripadvisor",
                    "/api/webhooks/expedia",
                    "/api/webhooks/whatsapp",
                    "/api/airbnb/callback",
                    "/api/minut/callback",
                    "/api/public/**",
                    "/ws/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakRoleConverter())))
            .addFilterAfter(tenantFilter, BearerTokenAuthenticationFilter.class)
            .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    private JwtAuthenticationConverter keycloakRoleConverter() {
        JwtGrantedAuthoritiesConverter defaultConverter = new JwtGrantedAuthoritiesConverter();
        defaultConverter.setAuthorityPrefix("ROLE_");
        defaultConverter.setAuthoritiesClaimName("scope");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Collection<GrantedAuthority> springScopes = defaultConverter.convert(jwt);
            Collection<? extends GrantedAuthority> realmRoles = extractRealmRoles(jwt);
            List<GrantedAuthority> all = new java.util.ArrayList<>(springScopes);
            all.addAll(realmRoles);
            return all;
        });
        return converter;
    }

    private Collection<? extends GrantedAuthority> extractRealmRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return List.of();
        Object roles = realmAccess.get("roles");
        if (!(roles instanceof List<?> list)) return List.of();

        List<GrantedAuthority> authorities = new java.util.ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof String role)) continue;
            String upper = role.toUpperCase();
            // Normalisation : anciens roles Keycloak -> nouveaux noms
            // Safety net tant que des JWT avec les anciens roles circulent
            if ("ADMIN".equals(upper)) {
                upper = "SUPER_ADMIN";
            } else if ("MANAGER".equals(upper)) {
                upper = "SUPER_MANAGER";
            }
            authorities.add(new SimpleGrantedAuthority("ROLE_" + upper));
        }
        return authorities;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOrigin("http://localhost:3000");
        config.addAllowedOrigin("http://localhost:3001");
        config.addAllowedOrigin("http://localhost:8080"); // Landing page (Vite dev)
        config.addAllowedMethod("GET");
        config.addAllowedMethod("POST");
        config.addAllowedMethod("PUT");
        config.addAllowedMethod("DELETE");
        config.addAllowedMethod("PATCH");
        config.addAllowedMethod("OPTIONS");
        config.addAllowedHeader("Authorization");
        config.addAllowedHeader("Content-Type");
        config.addAllowedHeader("Accept");
        config.addAllowedHeader("X-Organization-Id");
        config.addExposedHeader("X-Organization-Id");
        config.addExposedHeader("X-RateLimit-Limit");
        config.addExposedHeader("X-RateLimit-Remaining");
        config.addExposedHeader("Retry-After");
        config.addExposedHeader("X-Request-Id");
        config.addExposedHeader("X-Response-Time");
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
