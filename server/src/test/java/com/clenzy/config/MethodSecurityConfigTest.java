package com.clenzy.config;

import com.clenzy.service.PermissionService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Verifie que {@code hasPermission(...)} devient evaluable dans une expression
 * {@code @PreAuthorize} des lors que {@link MethodSecurityConfig} est presente
 * — le cablage, donc, et pas seulement l'evaluateur pris isolement
 * ({@link BaitlyPermissionEvaluatorTest}).
 *
 * <p>Son contre-exemple vit dans {@link MethodSecurityDefaultDenyTest} : meme
 * appel, meme permission accordee, mais sans cette configuration — et l'acces
 * est refuse. C'est le mode de defaillance qui rendait les rapports
 * injoignables.</p>
 */
@SpringJUnitConfig(MethodSecurityConfigTest.Config.class)
class MethodSecurityConfigTest {

    static final String KEYCLOAK_ID = "b3f1c2d4-0000-4a11-9f00-aaaabbbbcccc";
    static final String PERMISSION = "reports:generate";

    /** Cible minimale : une methode gardee par une permission. */
    static class GuardedService {
        @PreAuthorize("hasPermission(null, 'reports:generate')")
        String run() {
            return "ok";
        }
    }

    /** Appelant authentifie par JWT, porteur d'un sujet Keycloak. */
    static Authentication jwtAuth() {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(KEYCLOAK_ID)
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .claim("sub", KEYCLOAK_ID)
            .build();
        return new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ROLE_SUPER_ADMIN"));
    }

    @Configuration
    @EnableMethodSecurity
    @Import(MethodSecurityConfig.class)
    static class Config {
        /**
         * {@link PermissionService} porte un {@code @PersistenceContext} : meme
         * mocke, le post-processeur de persistance de Spring reclame une
         * fabrique d'EntityManager au moment de cabler le bean. Ce mock la lui
         * donne ; l'EntityManager partage etant resolu paresseusement, il n'est
         * jamais sollicite — aucune des methodes exercees ici ne touche au JPA.
         */
        @Bean
        EntityManagerFactory entityManagerFactory() {
            EntityManagerFactory factory = Mockito.mock(EntityManagerFactory.class);
            Mockito.lenient().when(factory.createEntityManager())
                .thenReturn(Mockito.mock(EntityManager.class));
            return factory;
        }

        @Bean
        PermissionService permissionService() {
            return Mockito.mock(PermissionService.class);
        }

        @Bean
        GuardedService guardedService() {
            return new GuardedService();
        }
    }

    @Autowired private GuardedService service;
    @Autowired private PermissionService permissionService;

    @BeforeEach
    void auth() {
        Mockito.reset(permissionService);
        SecurityContextHolder.getContext().setAuthentication(jwtAuth());
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("permission accordee : l'appel passe")
    void whenPermissionGranted_thenAllowed() {
        when(permissionService.checkUserPermission(KEYCLOAK_ID, PERMISSION)).thenReturn(true);

        assertThat(service.run()).isEqualTo("ok");
    }

    @Test
    @DisplayName("permission refusee : refus d'acces franc")
    void whenPermissionDenied_thenAccessDenied() {
        when(permissionService.checkUserPermission(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.run()).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("principal sans sujet Keycloak : refus, et le service n'est pas interroge")
    void whenPrincipalIsNotJwt_thenAccessDenied() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("alice", "n/a",
                AuthorityUtils.createAuthorityList("ROLE_SUPER_ADMIN")));

        assertThatThrownBy(() -> service.run()).isInstanceOf(AccessDeniedException.class);
        Mockito.verify(permissionService, Mockito.never())
            .checkUserPermission(anyString(), anyString());
    }
}
