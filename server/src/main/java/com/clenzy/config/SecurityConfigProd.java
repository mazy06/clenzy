package com.clenzy.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.filter.CorsFilter;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantFilter;
import jakarta.persistence.EntityManager;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Profile("prod")
public class SecurityConfigProd {

    @Value("${cors.allowed-origins:https://app.clenzy.fr,https://clenzy.fr,https://www.clenzy.fr}")
    private String allowedOrigins;

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

    private List<String> getAllowedOriginsList() {
        return Arrays.asList(allowedOrigins.split(","));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, TenantFilter tenantFilter,
                                                    SecurityAuditAccessDeniedHandler accessDeniedHandler,
                                                    SecurityAuditAuthEntryPoint authEntryPoint) throws Exception {
        http
                // CSRF disabled: architecture JWT stateless sans cookies de session.
                // Les tokens JWT sont transmis via le header Authorization (Bearer),
                // ce qui rend les attaques CSRF non applicables (pas de credentials automatiques).
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(headers -> headers
                    .frameOptions(frame -> frame.sameOrigin())                         // X-Frame-Options: SAMEORIGIN (cohérent avec frame-ancestors 'self')
                    .contentTypeOptions(Customizer.withDefaults())                     // X-Content-Type-Options: nosniff
                    .cacheControl(Customizer.withDefaults())                           // Cache-Control: no-cache, no-store, must-revalidate (sur toutes les reponses API)
                    .httpStrictTransportSecurity(hsts -> hsts
                        .includeSubDomains(true)
                        .maxAgeInSeconds(31536000)
                        .preload(true)
                    )
                    .referrerPolicy(referrer -> referrer
                        .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                    )
                    .permissionsPolicy(permissions -> permissions
                        .policy("camera=(), microphone=(), geolocation=(), payment=()")
                    )
                )
                // CSP retiré du backend API : les réponses JSON ne sont pas rendues dans le DOM.
                // Le CSP doit être configuré sur nginx (app.clenzy.fr) qui sert les pages HTML.
                .exceptionHandling(ex -> ex
                    .accessDeniedHandler(accessDeniedHandler)
                    .authenticationEntryPoint(authEntryPoint)
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Endpoints publics
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/webhooks/stripe").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        // Invitations : info publique (sans JWT), accept authentifie
                        .requestMatchers(HttpMethod.GET, "/api/invitations/info").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/invitations/accept").authenticated()
                        // OAuth callbacks (appeles par les providers externes sans JWT)
                        .requestMatchers("/api/airbnb/callback").permitAll()
                        .requestMatchers("/api/minut/callback").permitAll()
                        // Actuator (health, info, prometheus et metrics sans auth — accès réseau Docker interne uniquement)
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/prometheus", "/actuator/metrics").hasRole("SUPER_ADMIN")
                        .requestMatchers("/actuator/**").hasRole("SUPER_ADMIN")
                        // Endpoints authentifies
                        .requestMatchers("/api/me").authenticated()
                        .requestMatchers("/api/**").hasAnyRole("SUPER_ADMIN","SUPER_MANAGER","HOST","TECHNICIAN","HOUSEKEEPER","SUPERVISOR","LAUNDRY","EXTERIOR_TECH")
                        .anyRequest().denyAll()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakRoleConverter())))
                .addFilterAfter(tenantFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOrigins(getAllowedOriginsList());
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Organization-Id"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After", "X-Request-Id", "X-Response-Time", "X-Organization-Id"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowCredentials(true);
        cfg.setAllowedOrigins(getAllowedOriginsList());
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Organization-Id"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After", "X-Request-Id", "X-Response-Time", "X-Organization-Id"));
        cfg.setMaxAge(3600L);
        source.registerCorsConfiguration("/**", cfg);
        return new CorsFilter(source);
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration(CorsFilter corsFilter) {
        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(corsFilter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    public WebMvcConfigurer webMvcConfigurer() {
        List<String> origins = getAllowedOriginsList();
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins(origins.toArray(new String[0]))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                        .allowedHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }

    private JwtAuthenticationConverter keycloakRoleConverter() {
        JwtGrantedAuthoritiesConverter defaultConverter = new JwtGrantedAuthoritiesConverter();
        defaultConverter.setAuthorityPrefix("ROLE_");
        defaultConverter.setAuthoritiesClaimName("scope");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Collection<GrantedAuthority> springScopes = defaultConverter.convert(jwt);
            Collection<? extends GrantedAuthority> realmRoles = extractRealmRoles(jwt);
            return join(springScopes, realmRoles);
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

    private Collection<GrantedAuthority> join(Collection<GrantedAuthority> a, Collection<? extends GrantedAuthority> b) {
        return List.copyOf(new java.util.LinkedHashSet<>(java.util.stream.Stream.concat(a.stream(), b.stream()).collect(Collectors.toList())));
    }

    @SuppressWarnings("unused")
    private Collection<? extends GrantedAuthority> extractClientRoles(Jwt jwt, String clientId) {
        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess == null) return List.of();
        Object client = resourceAccess.get(clientId);
        if (!(client instanceof Map<?, ?> clientMap)) return List.of();
        Object roles = clientMap.get("roles");
        if (!(roles instanceof List<?> list)) return List.of();
        return list.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                .collect(Collectors.toList());
    }
}
