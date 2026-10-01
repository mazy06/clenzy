package com.clenzy.controller;

import com.clenzy.config.MethodSecurityConfig;
import com.clenzy.service.PermissionService;
import com.clenzy.service.ReportService;
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
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Verifie les gardes de {@link ReportController}, exprimes par la permission
 * {@code reports:generate}.
 *
 * <p><b>Regression couverte</b> : l'expression {@code hasPermission} etait
 * inerte faute de {@code PermissionEvaluator} enregistre — Spring Security
 * retombait sur {@code DenyAllPermissionEvaluator} et fermait les quatre routes
 * a <b>tout le monde</b>, staff plateforme compris. Les tests d'acces
 * ci-dessous echouent donc si {@link MethodSecurityConfig} disparait du
 * contexte : un test de refus seul aurait passe avec le bug en place.</p>
 *
 * <p><b>Pourquoi des JWT et non {@code @WithMockUser}</b> : la permission se
 * resout sur le sujet Keycloak de l'appelant, qu'un utilisateur mocke ne porte
 * pas. Les profils sont donc joues par un jeton, et la table role → permissions
 * ({@code PermissionInitializer}) est rejouee par le stub du service — ce qui
 * garde les cas lisibles en termes de profils.</p>
 */
@SpringJUnitConfig(ReportControllerSecurityTest.Config.class)
class ReportControllerSecurityTest {

    /** Porteurs de {@code reports:generate}. */
    private static final String SUPER_ADMIN = "sub-super-admin";
    private static final String SUPER_MANAGER = "sub-super-manager";
    /** Profils sans la permission. */
    private static final String HOST = "sub-host";
    private static final String SUPERVISOR = "sub-supervisor";
    private static final String HOUSEKEEPER = "sub-housekeeper";

    private static final String PERMISSION = "reports:generate";

    @Configuration
    @EnableMethodSecurity
    @Import(MethodSecurityConfig.class)
    static class Config {
        @Bean
        ReportService reportService() {
            return Mockito.mock(ReportService.class);
        }

        @Bean
        PermissionService permissionService() {
            return Mockito.mock(PermissionService.class);
        }

        /** Cf. {@code MethodSecurityConfigTest} : le mock porte un @PersistenceContext. */
        @Bean
        EntityManagerFactory entityManagerFactory() {
            EntityManagerFactory factory = Mockito.mock(EntityManagerFactory.class);
            Mockito.lenient().when(factory.createEntityManager())
                .thenReturn(Mockito.mock(EntityManager.class));
            return factory;
        }

        @Bean
        ReportController controller(ReportService reportService) {
            return new ReportController(reportService);
        }
    }

    @Autowired private ReportController controller;
    @Autowired private ReportService reportService;
    @Autowired private PermissionService permissionService;

    private static final java.time.LocalDate FROM = java.time.LocalDate.of(2026, 1, 1);
    private static final java.time.LocalDate TO = java.time.LocalDate.of(2026, 1, 31);

    @BeforeEach
    void setUp() {
        Mockito.reset(reportService, permissionService);
        // La table du PermissionInitializer : seul le staff plateforme genere.
        Mockito.lenient().when(permissionService.checkUserPermission(anyString(), anyString()))
            .thenReturn(false);
        Mockito.lenient().when(permissionService.checkUserPermission(SUPER_ADMIN, PERMISSION))
            .thenReturn(true);
        Mockito.lenient().when(permissionService.checkUserPermission(SUPER_MANAGER, PERMISSION))
            .thenReturn(true);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    /** Authentifie l'appelant sous ce sujet Keycloak. */
    private void authenticatedAs(String subject) {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(subject)
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .claim("sub", subject)
            .build();
        Authentication auth = new JwtAuthenticationToken(
            jwt, AuthorityUtils.createAuthorityList("ROLE_USER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // ── Acces : les porteurs de reports:generate ─────────────────────────────

    @Test
    @DisplayName("SUPER_ADMIN genere un rapport financier — l'expression inerte le refusait aussi")
    void whenSuperAdminGeneratesFinancial_thenAllowed() {
        authenticatedAs(SUPER_ADMIN);
        when(reportService.generateFinancialReport(anyString(), any(), any()))
            .thenReturn(new byte[] { 1, 2, 3 });

        assertThat(controller.generateFinancialReport("revenue", FROM, TO).getStatusCode())
            .isEqualTo(HttpStatus.OK);
    }

    @Test
    void whenSuperManagerGeneratesInterventions_thenAllowed() {
        authenticatedAs(SUPER_MANAGER);
        when(reportService.generateInterventionReport(anyString(), any(), any()))
            .thenReturn(new byte[] { 1, 2, 3 });

        assertThat(controller.generateInterventionReport("summary", FROM, TO).getStatusCode())
            .isEqualTo(HttpStatus.OK);
    }

    @Test
    void whenSuperManagerGeneratesTeams_thenAllowed() {
        authenticatedAs(SUPER_MANAGER);
        when(reportService.generateTeamReport(anyString(), any(), any()))
            .thenReturn(new byte[] { 1, 2, 3 });

        assertThat(controller.generateTeamReport("activity", FROM, TO).getStatusCode())
            .isEqualTo(HttpStatus.OK);
    }

    @Test
    void whenSuperAdminGeneratesProperties_thenAllowed() {
        authenticatedAs(SUPER_ADMIN);
        when(reportService.generatePropertyReport(anyString(), any(), any()))
            .thenReturn(new byte[] { 1, 2, 3 });

        assertThat(controller.generatePropertyReport("occupancy", FROM, TO).getStatusCode())
            .isEqualTo(HttpStatus.OK);
    }

    // ── Refus : tout le reste ────────────────────────────────────────────────

    @Test
    @DisplayName("HOST n'a pas reports:generate : refus d'acces")
    void whenHostGeneratesFinancial_thenAccessDenied() {
        authenticatedAs(HOST);

        assertThatThrownBy(() -> controller.generateFinancialReport("revenue", FROM, TO))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reportService);
    }

    @Test
    void whenSupervisorGeneratesTeams_thenAccessDenied() {
        authenticatedAs(SUPERVISOR);

        assertThatThrownBy(() -> controller.generateTeamReport("activity", FROM, TO))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reportService);
    }

    @Test
    void whenHousekeeperGeneratesInterventions_thenAccessDenied() {
        authenticatedAs(HOUSEKEEPER);

        assertThatThrownBy(() -> controller.generateInterventionReport("summary", FROM, TO))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reportService);
    }

    @Test
    @DisplayName("sans authentification : refus avant meme d'evaluer la permission")
    void whenUnauthenticated_thenRejected() {
        // Spring tranche des l'absence d'Authentication : l'expression n'est
        // jamais evaluee, d'ou un refus d'authentification et non d'acces.
        assertThatThrownBy(() -> controller.generateFinancialReport("revenue", FROM, TO))
            .isInstanceOfAny(AccessDeniedException.class,
                             AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(reportService);
    }

    @Test
    @DisplayName("retirer la permission a un role la retire a l'API — c'est tout l'interet")
    void whenPermissionRevoked_thenPreviouslyAllowedProfileIsDenied() {
        authenticatedAs(SUPER_MANAGER);
        // L'administrateur retire reports:generate a SUPER_MANAGER depuis l'ecran.
        when(permissionService.checkUserPermission(SUPER_MANAGER, PERMISSION)).thenReturn(false);

        assertThatThrownBy(() -> controller.generateFinancialReport("revenue", FROM, TO))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reportService);
    }
}
