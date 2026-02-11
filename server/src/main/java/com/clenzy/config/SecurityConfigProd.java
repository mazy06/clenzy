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
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.filter.CorsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
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

    @Value("${cors.allowed-origins:https://app.clenzy.fr}")
    private String allowedOrigins;

    private List<String> getAllowedOriginsList() {
        return Arrays.asList(allowedOrigins.split(","));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(headers -> headers
                    .frameOptions(frame -> frame.deny())                              // X-Frame-Options: DENY
                    .contentTypeOptions(Customizer.withDefaults())                     // X-Content-Type-Options: nosniff
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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Endpoints publics
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/webhooks/stripe").permitAll()
                        .requestMatchers("/api/contact/**").permitAll()
                        // Actuator (seulement health et info sans auth)
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").hasRole("ADMIN")
                        // Endpoints authentifies
                        .requestMatchers("/api/me").authenticated()
                        .requestMatchers("/api/**").hasAnyRole("ADMIN","MANAGER","HOST","TECHNICIAN","HOUSEKEEPER","SUPERVISOR")
                        .anyRequest().denyAll()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakRoleConverter())));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOrigins(getAllowedOriginsList());
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"));
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
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"));
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
        return list.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                .collect(Collectors.toList());
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
