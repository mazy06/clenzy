package com.clenzy.service;

import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.dto.manager.AssignmentResultDto;
import com.clenzy.dto.manager.ManagerTeamSummaryDto;
import com.clenzy.dto.manager.ManagerUserSummaryDto;
import com.clenzy.dto.manager.TeamUserAssignmentResultDto;
import com.clenzy.dto.manager.UnassignmentResultDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ManagerServiceTest {

    @Mock private PortfolioRepository portfolioRepository;
    @Mock private PortfolioClientRepository portfolioClientRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private UserRepository userRepository;
    @Mock private ManagerTeamRepository managerTeamRepository;
    @Mock private ManagerUserRepository managerUserRepository;
    @Mock private ManagerPropertyRepository managerPropertyRepository;

    private TenantContext tenantContext;
    private ManagerService managerService;

    private static final Long ORG_ID = 1L;
    private static final Long MANAGER_ID = 10L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        managerService = new ManagerService(
                portfolioRepository, portfolioClientRepository, propertyRepository,
                teamRepository, userRepository, managerTeamRepository,
                managerUserRepository, managerPropertyRepository, tenantContext);
    }

    private User buildUser(Long id, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setFirstName("User");
        user.setLastName("Test");
        user.setEmail("user" + id + "@test.com");
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setKeycloakId("kc-" + id);
        return user;
    }

    private Jwt buildJwt(String subject, String... roles) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));
        if (roles.length > 0) {
            builder.claim("realm_access", Map.of("roles", List.of(roles)));
        }
        return builder.build();
    }

    // ===== RESOLVE MANAGER ID =====

    @Nested
    class ResolveManagerId {

        @Test
        void whenNumericId_thenReturnsLong() {
            Optional<Long> result = managerService.resolveManagerId("42");
            assertThat(result).contains(42L);
        }

        @Test
        void whenKeycloakUuid_thenLooksUpByKeycloakId() {
            User user = buildUser(42L, UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-uuid-123")).thenReturn(Optional.of(user));

            Optional<Long> result = managerService.resolveManagerId("kc-uuid-123");
            assertThat(result).contains(42L);
        }

        @Test
        void whenKeycloakUuidNotFound_thenReturnsEmpty() {
            when(userRepository.findByKeycloakId("unknown-uuid")).thenReturn(Optional.empty());

            Optional<Long> result = managerService.resolveManagerId("unknown-uuid");
            assertThat(result).isEmpty();
        }
    }

    // ===== VALIDATE MANAGER OWNERSHIP =====

    @Nested
    class ValidateManagerOwnership {

        @Test
        void whenSuperAdmin_thenAccessGranted() {
            Jwt jwt = buildJwt("kc-admin", "SUPER_ADMIN");

            // Should not throw
            managerService.validateManagerOwnership(jwt, 999L);
        }

        @Test
        void whenOwner_thenAccessGranted() {
            Jwt jwt = buildJwt("kc-10");
            User user = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-10")).thenReturn(Optional.of(user));

            managerService.validateManagerOwnership(jwt, MANAGER_ID);
        }

        @Test
        void whenNotOwnerAndNotAdmin_thenThrowsAccessDenied() {
            Jwt jwt = buildJwt("kc-other");
            User otherUser = buildUser(99L, UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(otherUser));

            assertThatThrownBy(() -> managerService.validateManagerOwnership(jwt, MANAGER_ID))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenUserNotFound_thenThrowsAccessDenied() {
            Jwt jwt = buildJwt("kc-unknown");
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> managerService.validateManagerOwnership(jwt, MANAGER_ID))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ===== LISTING ENDPOINTS =====

    @Nested
    class ListingEndpoints {

        @Test
        void getAllManagersAndAdmins_returnsCorrectSummaries() {
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            User manager = buildUser(2L, UserRole.SUPER_MANAGER);
            when(userRepository.findByRoleIn(any(), eq(ORG_ID)))
                    .thenReturn(List.of(admin, manager));

            List<ManagerUserSummaryDto> result = managerService.getAllManagersAndAdmins();

            assertThat(result).hasSize(2);
            assertThat(result.get(0).id()).isEqualTo(1L);
            assertThat(result.get(1).id()).isEqualTo(2L);
        }

        @Test
        void getOperationalUsers_filtersCorrectRoles() {
            User tech = buildUser(3L, UserRole.TECHNICIAN);
            User hk = buildUser(4L, UserRole.HOUSEKEEPER);
            when(userRepository.findByRoleIn(any(), eq(ORG_ID)))
                    .thenReturn(List.of(tech, hk));

            List<ManagerUserSummaryDto> result = managerService.getOperationalUsers();

            assertThat(result).hasSize(2);
        }

        @Test
        void getAllTeamSummaries_returnsAllTeams() {
            Team team = new Team();
            team.setId(1L);
            team.setName("Team A");
            team.setDescription("A very long description that exceeds fifty characters limit for testing truncation");
            when(teamRepository.findAll()).thenReturn(List.of(team));

            List<ManagerTeamSummaryDto> result = managerService.getAllTeamSummaries();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Team A");
            // Description should be truncated to 50 chars
            assertThat(result.get(0).description()).hasSizeLessThanOrEqualTo(50);
        }
    }

    // ===== ASSIGN TEAMS AND USERS =====

    @Nested
    class AssignTeamsAndUsers {

        @Test
        void whenNewTeamsAndUsers_thenAssignsAll() {
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    eq(MANAGER_ID), anyLong(), eq(ORG_ID))).thenReturn(false);
            when(managerUserRepository.existsByManagerIdAndUserIdAndIsActiveTrue(
                    eq(MANAGER_ID), anyLong(), eq(ORG_ID))).thenReturn(false);
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(managerUserRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest(
                    MANAGER_ID, List.of(1L, 2L), List.of(3L, 4L));

            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            assertThat(result.message()).contains("reussie");
            assertThat(result.teamsAssigned()).isEqualTo(2);
            assertThat(result.usersAssigned()).isEqualTo(2);
        }

        @Test
        void whenTeamAlreadyAssigned_thenSkipsIt() {
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    MANAGER_ID, 1L, ORG_ID)).thenReturn(true);
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    MANAGER_ID, 2L, ORG_ID)).thenReturn(false);
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest(
                    MANAGER_ID, List.of(1L, 2L), List.of());

            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            assertThat(result.teamsAssigned()).isEqualTo(1);
        }

        @Test
        void whenNullLists_thenAssignsNothing() {
            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest();

            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            assertThat(result.teamsAssigned()).isZero();
            assertThat(result.usersAssigned()).isZero();
        }
    }

    // ===== UNASSIGN TEAM =====

    @Nested
    class UnassignTeam {

        @Test
        void whenTeamAssigned_thenSoftDeletesAssociation() {
            ManagerTeam mt = new ManagerTeam(MANAGER_ID, 1L);
            mt.setId(100L);
            when(managerTeamRepository.findAllByManagerIdAndTeamId(MANAGER_ID, 1L, ORG_ID))
                    .thenReturn(List.of(mt));
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UnassignmentResultDto result = managerService.unassignTeam(MANAGER_ID, 1L);

            assertThat(result.removedCount()).isEqualTo(1);

            ArgumentCaptor<ManagerTeam> captor = ArgumentCaptor.forClass(ManagerTeam.class);
            verify(managerTeamRepository).save(captor.capture());
            assertThat(captor.getValue().getIsActive()).isFalse();
        }

        @Test
        void whenNoAssociation_thenReturnsZeroCount() {
            when(managerTeamRepository.findAllByManagerIdAndTeamId(MANAGER_ID, 1L, ORG_ID))
                    .thenReturn(List.of());

            UnassignmentResultDto result = managerService.unassignTeam(MANAGER_ID, 1L);

            assertThat(result.removedCount()).isZero();
        }
    }

    // ===== UNASSIGN USER =====

    @Nested
    class UnassignUser {

        @Test
        void whenUserAssigned_thenSoftDeletesAssociation() {
            ManagerUser mu = new ManagerUser(MANAGER_ID, 5L);
            mu.setId(200L);
            when(managerUserRepository.findAllByManagerIdAndUserId(MANAGER_ID, 5L, ORG_ID))
                    .thenReturn(List.of(mu));
            when(managerUserRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UnassignmentResultDto result = managerService.unassignUser(MANAGER_ID, 5L);

            assertThat(result.removedCount()).isEqualTo(1);
            ArgumentCaptor<ManagerUser> captor = ArgumentCaptor.forClass(ManagerUser.class);
            verify(managerUserRepository).save(captor.capture());
            assertThat(captor.getValue().getIsActive()).isFalse();
        }
    }

    // ===== AVAILABLE HOSTS =====

    @Nested
    class AvailableHosts {

        @Test
        void whenHostHasUnassignedProperty_thenIncluded() {
            User host = buildUser(20L, UserRole.HOST);
            Property prop = new Property();
            prop.setId(100L);
            prop.setOwner(host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(false);

            List<User> result = managerService.getAvailableHosts();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(20L);
        }

        @Test
        void whenHostHasAllPropertiesAssigned_thenExcluded() {
            User host = buildUser(20L, UserRole.HOST);
            Property prop = new Property();
            prop.setId(100L);
            prop.setOwner(host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(true);

            List<User> result = managerService.getAvailableHosts();

            assertThat(result).isEmpty();
        }

        @Test
        void whenHostHasNoProperties_thenIncluded() {
            User host = buildUser(20L, UserRole.HOST);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of());

            List<User> result = managerService.getAvailableHosts();

            assertThat(result).hasSize(1);
        }
    }

    // ===== AVAILABLE PROPERTIES FOR HOST =====

    @Nested
    class AvailablePropertiesForHost {

        @Test
        void whenSomePropertiesUnassigned_thenReturnsOnlyUnassigned() {
            Property assigned = new Property();
            assigned.setId(1L);
            Property unassigned = new Property();
            unassigned.setId(2L);

            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(assigned, unassigned));
            when(managerPropertyRepository.existsByPropertyId(1L, ORG_ID)).thenReturn(true);
            when(managerPropertyRepository.existsByPropertyId(2L, ORG_ID)).thenReturn(false);

            List<Property> result = managerService.getAvailablePropertiesForHost(20L);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(2L);
        }
    }

    // ===== PROPERTY UNASSIGNMENT =====

    @Nested
    class UnassignProperty {

        @Test
        void whenPropertyAssigned_thenDeletesAssociation() {
            Property property = new Property();
            property.setId(100L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

            ManagerProperty mp = new ManagerProperty(MANAGER_ID, 100L, "test");
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(mp);

            var result = managerService.unassignPropertyFromManager(MANAGER_ID, 100L);

            assertThat(result.propertyId()).isEqualTo(100L);
            verify(managerPropertyRepository).delete(mp);
        }

        @Test
        void whenPropertyNotFound_thenThrowsIllegalArgument() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> managerService.unassignPropertyFromManager(MANAGER_ID, 999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        void whenPropertyNotAssigned_thenThrowsIllegalArgument() {
            Property property = new Property();
            property.setId(100L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(null);

            assertThatThrownBy(() -> managerService.unassignPropertyFromManager(MANAGER_ID, 100L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non assignee");
        }
    }
}
