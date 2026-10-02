package com.clenzy.config;

import com.clenzy.service.PermissionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link BaitlyPermissionEvaluator} : traduction d'une expression
 * {@code hasPermission} en question posee a {@link PermissionService}, et refus
 * de tout ce qui ne se laisse pas identifier.
 */
class BaitlyPermissionEvaluatorTest {

    private static final String KEYCLOAK_ID = "b3f1c2d4-0000-4a11-9f00-aaaabbbbcccc";

    private PermissionService permissionService;
    private BaitlyPermissionEvaluator evaluator;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        permissionService = Mockito.mock(PermissionService.class);
        ObjectProvider<PermissionService> provider = Mockito.mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(permissionService);
        evaluator = new BaitlyPermissionEvaluator(provider);
    }

    @AfterEach
    void tearDown() {
        Mockito.reset(permissionService);
    }

    private Authentication jwtAuth(String subject) {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(subject)
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .claim("sub", subject)
            .build();
        return new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ROLE_SUPER_ADMIN"));
    }

    // ── Le chemin nominal ────────────────────────────────────────────────────

    @Test
    @DisplayName("la permission est demandee au service pour le sujet du JWT")
    void whenJwtAuthenticated_thenDelegatesWithKeycloakSubject() {
        when(permissionService.checkUserPermission(KEYCLOAK_ID, "reports:generate")).thenReturn(true);

        assertThat(evaluator.hasPermission(jwtAuth(KEYCLOAK_ID), null, "reports:generate")).isTrue();
        verify(permissionService).checkUserPermission(KEYCLOAK_ID, "reports:generate");
    }

    @Test
    @DisplayName("un refus du service est un refus")
    void whenServiceDenies_thenFalse() {
        when(permissionService.checkUserPermission(anyString(), anyString())).thenReturn(false);

        assertThat(evaluator.hasPermission(jwtAuth(KEYCLOAK_ID), null, "reports:generate")).isFalse();
    }

    // ── Fail-closed ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("sans authentification, refus sans meme interroger le service")
    void whenNoAuthentication_thenDeniedWithoutLookup() {
        assertThat(evaluator.hasPermission(null, null, "reports:generate")).isFalse();
        verify(permissionService, never()).checkUserPermission(anyString(), anyString());
    }

    @Test
    @DisplayName("un principal qui n'est pas un JWT n'a pas de sujet Keycloak : refus")
    void whenPrincipalIsNotJwt_thenDenied() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
            "alice", "n/a", AuthorityUtils.createAuthorityList("ROLE_SUPER_ADMIN"));

        assertThat(evaluator.hasPermission(auth, null, "reports:generate")).isFalse();
        verify(permissionService, never()).checkUserPermission(anyString(), anyString());
    }

    @Test
    void whenAnonymous_thenDenied() {
        Authentication auth = new AnonymousAuthenticationToken(
            "key", "anonymous", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS"));

        assertThat(evaluator.hasPermission(auth, null, "reports:generate")).isFalse();
        verify(permissionService, never()).checkUserPermission(anyString(), anyString());
    }

    @Test
    @DisplayName("permission absente : refus, jamais un acces par defaut")
    void whenPermissionNull_thenDenied() {
        assertThat(evaluator.hasPermission(jwtAuth(KEYCLOAK_ID), null, null)).isFalse();
        verify(permissionService, never()).checkUserPermission(anyString(), anyString());
    }

    @Test
    @DisplayName("service indisponible : refus, pas de laissez-passer")
    @SuppressWarnings("unchecked")
    void whenServiceUnavailable_thenDenied() {
        ObjectProvider<PermissionService> empty = Mockito.mock(ObjectProvider.class);
        when(empty.getIfAvailable()).thenReturn(null);

        assertThat(new BaitlyPermissionEvaluator(empty)
            .hasPermission(jwtAuth(KEYCLOAK_ID), null, "reports:generate")).isFalse();
    }

    @Test
    @DisplayName("la forme par cible n'est pas supportee et refuse")
    void whenTargetIdForm_thenDenied() {
        assertThat(evaluator.hasPermission(jwtAuth(KEYCLOAK_ID), 42L, "Report", "reports:generate"))
            .isFalse();
        verify(permissionService, never()).checkUserPermission(anyString(), anyString());
    }

    @Test
    @DisplayName("la permission est transmise telle quelle, sans interpretation")
    void whenPermissionGiven_thenPassedVerbatim() {
        when(permissionService.checkUserPermission(anyString(), anyString())).thenReturn(true);

        List.of("reports:generate", "documents:view", "settings:edit")
            .forEach(p -> evaluator.hasPermission(jwtAuth(KEYCLOAK_ID), null, p));

        verify(permissionService).checkUserPermission(KEYCLOAK_ID, "reports:generate");
        verify(permissionService).checkUserPermission(KEYCLOAK_ID, "documents:view");
        verify(permissionService).checkUserPermission(KEYCLOAK_ID, "settings:edit");
    }
}
