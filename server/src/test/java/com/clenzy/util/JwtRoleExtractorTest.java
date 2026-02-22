package com.clenzy.util;

import com.clenzy.model.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtRoleExtractorTest {

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Jwt mockJwtWithRealmRoles(List<String> roles) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", roles));
        return jwt;
    }

    private Jwt mockJwtWithDirectRole(String role) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(null);
        when(jwt.getClaimAsString("role")).thenReturn(role);
        return jwt;
    }

    // ── Null JWT ─────────────────────────────────────────────────────────────

    @Test
    void whenJwtIsNull_thenReturnsHost() {
        assertThat(JwtRoleExtractor.extractUserRole(null)).isEqualTo(UserRole.HOST);
    }

    // ── realm-admin mapping ──────────────────────────────────────────────────

    @Test
    void whenRealmAdminInRoles_thenReturnsSuperAdmin() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("offline_access", "realm-admin", "HOST"));
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.SUPER_ADMIN);
    }

    // ── Platform staff priority ──────────────────────────────────────────────

    @Test
    void whenSuperManagerInRoles_thenReturnsSuperManager() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("SUPER_MANAGER", "HOST"));
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.SUPER_MANAGER);
    }

    @Test
    void whenMixedRolesWithPlatformStaff_thenPlatformStaffWins() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("TECHNICIAN", "SUPER_ADMIN", "HOST"));
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.SUPER_ADMIN);
    }

    // ── Business roles ───────────────────────────────────────────────────────

    @Test
    void whenHostRoleInRoles_thenReturnsHost() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("offline_access", "HOST", "uma_authorization"));
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.HOST);
    }

    @Test
    void whenTechnicianRoleInRoles_thenReturnsTechnician() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("default-roles-clenzy", "TECHNICIAN"));
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.TECHNICIAN);
    }

    // ── Technical roles only ─────────────────────────────────────────────────

    @Test
    void whenOnlyTechnicalRoles_thenFallsBackToHost() {
        Jwt jwt = mockJwtWithRealmRoles(List.of("offline_access", "uma_authorization", "default-roles-clenzy"));
        when(jwt.getClaimAsString("role")).thenReturn(null);
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.HOST);
    }

    // ── Direct role fallback ─────────────────────────────────────────────────

    @Test
    void whenNoRealmAccess_thenUsesDirectRoleClaim() {
        Jwt jwt = mockJwtWithDirectRole("HOUSEKEEPER");
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.HOUSEKEEPER);
    }

    @Test
    void whenDirectRoleIsUnknown_thenReturnsHost() {
        Jwt jwt = mockJwtWithDirectRole("UNKNOWN_ROLE");
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.HOST);
    }

    // ── No role at all ───────────────────────────────────────────────────────

    @Test
    void whenNoRealmAccessAndNoDirectRole_thenReturnsHost() {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(null);
        when(jwt.getClaimAsString("role")).thenReturn(null);
        assertThat(JwtRoleExtractor.extractUserRole(jwt)).isEqualTo(UserRole.HOST);
    }
}
