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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Contre-exemple de {@link MethodSecurityConfigTest} : le meme appel, le meme
 * utilisateur titulaire de la permission, mais <b>sans</b>
 * {@link MethodSecurityConfig}.
 *
 * <p>Spring Security retombe alors sur son {@code DenyAllPermissionEvaluator},
 * qui repond invariablement {@code false} : la route n'est pas filtree, elle est
 * fermee a tout le monde. Ce test fige ce comportement pour qu'il reste
 * explicite — c'est lui qui rendait les quatre rapports de
 * {@code ReportController} injoignables, sans que rien dans le code appelant ne
 * le laisse voir.</p>
 *
 * <p>Sa valeur est donc documentaire autant que defensive : si quelqu'un retire
 * {@code MethodSecurityConfig} du contexte, {@link MethodSecurityConfigTest}
 * tombe et celui-ci explique pourquoi.</p>
 */
@SpringJUnitConfig(MethodSecurityDefaultDenyTest.Config.class)
class MethodSecurityDefaultDenyTest {

    @Configuration
    @EnableMethodSecurity
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
        MethodSecurityConfigTest.GuardedService guardedService() {
            return new MethodSecurityConfigTest.GuardedService();
        }
    }

    @Autowired private MethodSecurityConfigTest.GuardedService service;
    @Autowired private PermissionService permissionService;

    @BeforeEach
    void auth() {
        SecurityContextHolder.getContext().setAuthentication(MethodSecurityConfigTest.jwtAuth());
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("sans le handler, meme titulaire de la permission, l'acces est refuse")
    void whenNoHandler_thenEveryoneDenied() {
        when(permissionService.checkUserPermission(anyString(), anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.run()).isInstanceOf(AccessDeniedException.class);
    }
}
