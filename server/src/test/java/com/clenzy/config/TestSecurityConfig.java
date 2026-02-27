package com.clenzy.config;

import org.springframework.beans.factory.config.CustomScopeConfigurer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.support.SimpleThreadScope;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.time.Instant;

/**
 * Configuration de securite pour les tests d'integration.
 * Fournit un JwtDecoder mock (pas de Keycloak en test)
 * et un scope "request" simule (SimpleThreadScope) pour les tests sans HTTP.
 */
@TestConfiguration
public class TestSecurityConfig {

    @Bean
    @Primary
    public JwtDecoder jwtDecoder() {
        // JwtDecoder qui retourne un JWT fixe (pas de validation)
        return token -> Jwt.withTokenValue(token)
                .header("alg", "none")
                .claim("sub", "test-user")
                .claim("preferred_username", "test@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    /**
     * Enregistre un SimpleThreadScope comme scope "request" pour les tests.
     * TenantContext est @RequestScope, mais en test sans servlet (webEnvironment=NONE)
     * le scope "request" n'existe pas. SimpleThreadScope le simule.
     */
    @Bean
    public static CustomScopeConfigurer customScopeConfigurer() {
        CustomScopeConfigurer configurer = new CustomScopeConfigurer();
        configurer.addScope("request", new SimpleThreadScope());
        return configurer;
    }
}
