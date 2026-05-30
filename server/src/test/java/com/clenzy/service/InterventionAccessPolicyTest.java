package com.clenzy.service;

import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.*;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InterventionAccessPolicyTest {

    @Mock private TenantContext tenantContext;
    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;

    private InterventionAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new InterventionAccessPolicy(tenantContext, userRepository, teamRepository);
    }

    private Jwt jwt(String role) {
        return Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .subject("kc-1")
                .claim("realm_access", Map.of("roles", List.of(role)))
                .claim("email", "u@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId("kc-1");
        return u;
    }

    private Intervention intervention(Long orgId, Property property, User assigned, Long teamId) {
        Intervention intervention = new Intervention();
        intervention.setOrganizationId(orgId);
        intervention.setProperty(property);
        intervention.setAssignedUser(assigned);
        intervention.setTeamId(teamId);
        return intervention;
    }

    @Nested
    @DisplayName("Tenant isolation")
    class TenantIsolation {

        @Test
        void crossOrg_throwsUnauthorized() {
            when(tenantContext.isSystemOrg()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);

            Intervention intervention = intervention(99L, null, null, null);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("SUPER_ADMIN")))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("hors de votre organisation");
        }

        @Test
        void sameOrg_passesTenantCheck() {
            when(tenantContext.isSystemOrg()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);

            Intervention intervention = intervention(7L, null, null, null);

            // Admin has full access
            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("SUPER_ADMIN")));
        }

        @Test
        void systemOrg_skipsTenantCheck() {
            when(tenantContext.isSystemOrg()).thenReturn(true);

            Intervention intervention = intervention(99L, null, null, null);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("SUPER_ADMIN")));
            verify(tenantContext, never()).getRequiredOrganizationId();
        }

        @Test
        void nullInterventionOrg_skipsCheck() {
            when(tenantContext.isSystemOrg()).thenReturn(false);

            Intervention intervention = intervention(null, null, null, null);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("SUPER_ADMIN")));
        }
    }

    @Nested
    @DisplayName("HOST role")
    class HostRole {

        @Test
        void ownsProperty_granted() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            User owner = user(42L);
            Property property = new Property();
            property.setOwner(owner);

            Intervention intervention = intervention(7L, property, null, null);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("HOST")));
        }

        @Test
        void notOwner_denied() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            User otherOwner = user(99L);
            Property property = new Property();
            property.setOwner(otherOwner);

            Intervention intervention = intervention(7L, property, null, null);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("HOST")))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("Acces non autorise");
        }

        @Test
        void nullProperty_denied() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            Intervention intervention = intervention(7L, null, null, null);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("HOST")))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("Non-HOST operational roles")
    class NonHostRoles {

        @Test
        void assignedUserMatches_granted() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            User assigned = user(42L);
            Intervention intervention = intervention(7L, null, assigned, null);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("TECHNICIAN")));
        }

        @Test
        void teamMember_granted() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            Team team = new Team();
            TeamMember member = new TeamMember();
            member.setUser(user(42L));
            team.setMembers(List.of(member));
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

            Intervention intervention = intervention(7L, null, null, 5L);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("HOUSEKEEPER")));
        }

        @Test
        void teamNotFound_denied() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));
            when(teamRepository.findById(5L)).thenReturn(Optional.empty());

            Intervention intervention = intervention(7L, null, null, 5L);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("TECHNICIAN")))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        void notInTeamAndNotAssigned_denied() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user(42L)));

            Intervention intervention = intervention(7L, null, null, null);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("TECHNICIAN")))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("User identification")
    class UserIdentification {

        @Test
        void userNotFoundByKeycloakIdNorEmail_throws() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId(anyString())).thenReturn(Optional.empty());
            when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());

            Intervention intervention = intervention(7L, null, null, null);

            assertThatThrownBy(() -> policy.assertCanAccess(intervention, jwt("TECHNICIAN")))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("Impossible d'identifier");
        }

        @Test
        void userFoundByEmail_proceeds() {
            when(tenantContext.isSystemOrg()).thenReturn(true);
            when(userRepository.findByKeycloakId(anyString())).thenReturn(Optional.empty());
            when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user(42L)));

            User assigned = user(42L);
            Intervention intervention = intervention(7L, null, assigned, null);

            assertThatNoException().isThrownBy(() -> policy.assertCanAccess(intervention, jwt("TECHNICIAN")));
        }
    }
}
