package com.clenzy.service;

import com.clenzy.dto.TeamDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Team;
import com.clenzy.model.TeamCoverageZone;
import com.clenzy.model.TeamMember;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.repository.TeamCoverageZoneRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamServiceTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private TeamCoverageZoneRepository teamCoverageZoneRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ManagerTeamRepository managerTeamRepository;

    @Mock
    private NotificationService notificationService;

    private TenantContext tenantContext;
    private TeamService teamService;

    private static final Long ORG_ID = 1L;
    private static final String KEYCLOAK_ID = "kc-user-123";

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        teamService = new TeamService(
                teamRepository,
                teamCoverageZoneRepository,
                userRepository,
                managerTeamRepository,
                notificationService,
                tenantContext
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Jwt buildJwtWithRole(String role) {
        return Jwt.withTokenValue("mock-token")
                .header("alg", "RS256")
                .subject(KEYCLOAK_ID)
                .claim("realm_access", Map.of("roles", List.of(role)))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private User buildUser(Long id, String firstName, String lastName, String email) {
        User user = new User(firstName, lastName, email, "password123");
        user.setId(id);
        user.setKeycloakId("kc-" + id);
        return user;
    }

    private Team buildTeam(Long id, String name) {
        Team team = new Team(name, "Description for " + name, "CLEANING");
        team.setId(id);
        team.setOrganizationId(ORG_ID);
        team.setMembers(new ArrayList<>());
        team.setCoverageZones(new ArrayList<>());
        return team;
    }

    private TeamDto buildTeamDto(String name, List<TeamDto.TeamMemberDto> members, List<TeamDto.CoverageZoneDto> zones) {
        TeamDto dto = new TeamDto();
        dto.name = name;
        dto.description = "Test description";
        dto.interventionType = "CLEANING";
        dto.members = members;
        dto.coverageZones = zones;
        return dto;
    }

    private TeamDto.TeamMemberDto buildMemberDto(Long userId, String role) {
        TeamDto.TeamMemberDto dto = new TeamDto.TeamMemberDto();
        dto.userId = userId;
        dto.role = role;
        return dto;
    }

    private TeamDto.CoverageZoneDto buildZoneDto(String department, String arrondissement) {
        TeamDto.CoverageZoneDto dto = new TeamDto.CoverageZoneDto();
        dto.department = department;
        dto.arrondissement = arrondissement;
        return dto;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // create()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class Create {

        @Test
        void create_nullJwt_throwsUnauthorizedException() {
            TeamDto dto = buildTeamDto("Team A", List.of(), null);

            assertThatThrownBy(() -> teamService.create(dto, null))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("Non authentifi");
        }

        @Test
        void create_nonStaffRole_throwsUnauthorizedException() {
            Jwt jwt = buildJwtWithRole("HOST");
            TeamDto dto = buildTeamDto("Team A", List.of(), null);

            assertThatThrownBy(() -> teamService.create(dto, jwt))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("administrateurs et managers");
        }

        @Test
        void create_superAdminRole_createsTeamSuccessfully() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            TeamDto dto = buildTeamDto("Team Alpha", List.of(), null);

            Team savedTeam = buildTeam(10L, "Team Alpha");
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);

            // Act
            TeamDto result = teamService.create(dto, jwt);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.name).isEqualTo("Team Alpha");
            verify(teamRepository).save(any(Team.class));
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.TEAM_CREATED), any(), any(), any());
        }

        @Test
        void create_superManagerRole_createsTeamSuccessfully() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_MANAGER");
            TeamDto dto = buildTeamDto("Team Beta", List.of(), null);

            Team savedTeam = buildTeam(11L, "Team Beta");
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);

            // Act
            TeamDto result = teamService.create(dto, jwt);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.name).isEqualTo("Team Beta");
            verify(teamRepository).save(any(Team.class));
        }

        @Test
        void create_withMembers_createsTeamWithMembers() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            User user1 = buildUser(1L, "Alice", "Dupont", "alice@test.com");
            User user2 = buildUser(2L, "Bob", "Martin", "bob@test.com");

            List<TeamDto.TeamMemberDto> members = List.of(
                    buildMemberDto(1L, "LEADER"),
                    buildMemberDto(2L, "MEMBER")
            );
            TeamDto dto = buildTeamDto("Team Gamma", members, null);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user2));

            Team savedTeam = buildTeam(12L, "Team Gamma");
            // Simulate saved team with members
            TeamMember tm1 = new TeamMember(savedTeam, user1, "LEADER");
            TeamMember tm2 = new TeamMember(savedTeam, user2, "MEMBER");
            savedTeam.setMembers(List.of(tm1, tm2));
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);

            // Act
            TeamDto result = teamService.create(dto, jwt);

            // Assert
            assertThat(result.members).hasSize(2);
            verify(userRepository).findById(1L);
            verify(userRepository).findById(2L);
        }

        @Test
        void create_withMemberNotFound_throwsNotFoundException() {
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");

            List<TeamDto.TeamMemberDto> members = List.of(buildMemberDto(999L, "MEMBER"));
            TeamDto dto = buildTeamDto("Team Bad", members, null);

            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> teamService.create(dto, jwt))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("999");
        }

        @Test
        void create_withCoverageZones_savesZones() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            List<TeamDto.CoverageZoneDto> zones = List.of(
                    buildZoneDto("75", "75001"),
                    buildZoneDto("92", null)
            );
            TeamDto dto = buildTeamDto("Team Zones", List.of(), zones);

            Team savedTeam = buildTeam(13L, "Team Zones");
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);
            when(teamCoverageZoneRepository.save(any(TeamCoverageZone.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            teamService.create(dto, jwt);

            // Assert
            ArgumentCaptor<TeamCoverageZone> captor = ArgumentCaptor.forClass(TeamCoverageZone.class);
            verify(teamCoverageZoneRepository, org.mockito.Mockito.times(2)).save(captor.capture());
            List<TeamCoverageZone> capturedZones = captor.getAllValues();
            assertThat(capturedZones).hasSize(2);
            assertThat(capturedZones.get(0).getDepartment()).isEqualTo("75");
            assertThat(capturedZones.get(1).getDepartment()).isEqualTo("92");
        }

        @Test
        void create_notificationFailure_doesNotPreventCreation() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            TeamDto dto = buildTeamDto("Team Notify", List.of(), null);

            Team savedTeam = buildTeam(14L, "Team Notify");
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);
            org.mockito.Mockito.doThrow(new RuntimeException("Kafka down"))
                    .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            // Act -- should not throw
            TeamDto result = teamService.create(dto, jwt);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.name).isEqualTo("Team Notify");
        }

        @Test
        void create_realmAdminRole_createsTeamSuccessfully() {
            // realm-admin maps to SUPER_ADMIN
            Jwt jwt = buildJwtWithRole("realm-admin");
            TeamDto dto = buildTeamDto("Team Realm", List.of(), null);

            Team savedTeam = buildTeam(15L, "Team Realm");
            when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);

            TeamDto result = teamService.create(dto, jwt);

            assertThat(result).isNotNull();
            assertThat(result.name).isEqualTo("Team Realm");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // update()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class Update {

        @Test
        void update_notFound_throwsNotFoundException() {
            when(teamRepository.findById(99L)).thenReturn(Optional.empty());
            TeamDto dto = buildTeamDto("Updated", null, null);

            assertThatThrownBy(() -> teamService.update(99L, dto))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("99");
        }

        @Test
        void update_validTeam_updatesFieldsAndNotifies() {
            // Arrange
            Team existing = buildTeam(1L, "Old Name");
            when(teamRepository.findById(1L)).thenReturn(Optional.of(existing));

            TeamDto dto = buildTeamDto("New Name", null, null);
            dto.description = "New description";
            dto.interventionType = "MAINTENANCE";

            when(teamRepository.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            TeamDto result = teamService.update(1L, dto);

            // Assert
            assertThat(result.name).isEqualTo("New Name");
            verify(teamRepository).save(any(Team.class));
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.TEAM_UPDATED), any(), any(), any());
        }

        @Test
        void update_withNewMembers_replacesMembers() {
            // Arrange
            Team existing = buildTeam(1L, "Team");
            existing.setMembers(new ArrayList<>());
            when(teamRepository.findById(1L)).thenReturn(Optional.of(existing));

            User user = buildUser(5L, "Charlie", "Durand", "charlie@test.com");
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));

            List<TeamDto.TeamMemberDto> newMembers = List.of(buildMemberDto(5L, "LEADER"));
            TeamDto dto = buildTeamDto("Team", newMembers, null);

            when(teamRepository.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            TeamDto result = teamService.update(1L, dto);

            // Assert
            assertThat(result).isNotNull();
            verify(userRepository).findById(5L);
        }

        @Test
        void update_withCoverageZones_replacesZones() {
            // Arrange
            Team existing = buildTeam(1L, "Team");
            existing.setCoverageZones(new ArrayList<>());
            when(teamRepository.findById(1L)).thenReturn(Optional.of(existing));

            List<TeamDto.CoverageZoneDto> zones = List.of(buildZoneDto("93", "93100"));
            TeamDto dto = buildTeamDto("Team", null, zones);

            when(teamRepository.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            teamService.update(1L, dto);

            // Assert
            verify(teamCoverageZoneRepository).deleteByTeamIdAndOrganizationId(1L, ORG_ID);
        }

        @Test
        void update_memberNotFound_throwsNotFoundException() {
            Team existing = buildTeam(1L, "Team");
            existing.setMembers(new ArrayList<>());
            when(teamRepository.findById(1L)).thenReturn(Optional.of(existing));

            List<TeamDto.TeamMemberDto> members = List.of(buildMemberDto(999L, "MEMBER"));
            TeamDto dto = buildTeamDto("Team", members, null);
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> teamService.update(1L, dto))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("999");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // getById()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class GetById {

        @Test
        void getById_found_returnsDto() {
            Team team = buildTeam(1L, "My Team");
            when(teamRepository.findById(1L)).thenReturn(Optional.of(team));

            TeamDto result = teamService.getById(1L);

            assertThat(result).isNotNull();
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.name).isEqualTo("My Team");
            assertThat(result.interventionType).isEqualTo("CLEANING");
        }

        @Test
        void getById_notFound_throwsNotFoundException() {
            when(teamRepository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> teamService.getById(42L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("42");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // list()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class ListTeams {

        private final Pageable pageable = PageRequest.of(0, 10);

        @Test
        void list_nullJwt_returnsAllTeams() {
            // Arrange
            Team team = buildTeam(1L, "Team A");
            Page<Team> page = new PageImpl<>(List.of(team), pageable, 1);
            when(teamRepository.findAll(pageable)).thenReturn(page);

            // Act
            Page<TeamDto> result = teamService.list(pageable, null);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).name).isEqualTo("Team A");
        }

        @Test
        void list_adminRole_returnsAllTeams() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            Team team1 = buildTeam(1L, "Team A");
            Team team2 = buildTeam(2L, "Team B");
            when(teamRepository.findAll()).thenReturn(List.of(team1, team2));

            // Act
            Page<TeamDto> result = teamService.list(pageable, jwt);

            // Assert
            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(2);
        }

        @Test
        void list_superManagerRole_returnsOnlyManagedTeams() {
            // Arrange
            Jwt jwt = buildJwtWithRole("SUPER_MANAGER");
            User managerUser = buildUser(10L, "Manager", "Test", "manager@test.com");
            managerUser.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(managerUser));
            when(managerTeamRepository.findTeamIdsByManagerIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(List.of(5L));

            Team managedTeam = buildTeam(5L, "Managed Team");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(managedTeam));

            // Act
            Page<TeamDto> result = teamService.list(pageable, jwt);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).name).isEqualTo("Managed Team");
        }

        @Test
        void list_superManagerRole_managerNotFound_returnsEmpty() {
            Jwt jwt = buildJwtWithRole("SUPER_MANAGER");
            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_housekeeperRole_returnsOnlyMemberTeams() {
            // Arrange
            Jwt jwt = buildJwtWithRole("HOUSEKEEPER");
            User housekeeper = buildUser(20L, "Housekeeper", "Test", "hk@test.com");
            housekeeper.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(housekeeper));

            Team memberTeam = buildTeam(8L, "My Team");
            when(teamRepository.findByUserId(20L, ORG_ID)).thenReturn(List.of(memberTeam));

            // Act
            Page<TeamDto> result = teamService.list(pageable, jwt);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).name).isEqualTo("My Team");
        }

        @Test
        void list_technicianRole_returnsOnlyMemberTeams() {
            Jwt jwt = buildJwtWithRole("TECHNICIAN");
            User tech = buildUser(21L, "Tech", "Test", "tech@test.com");
            tech.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(tech));
            when(teamRepository.findByUserId(21L, ORG_ID)).thenReturn(List.of());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_supervisorRole_returnsOnlyMemberTeams() {
            Jwt jwt = buildJwtWithRole("SUPERVISOR");
            User supervisor = buildUser(22L, "Super", "Visor", "sv@test.com");
            supervisor.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(supervisor));
            when(teamRepository.findByUserId(22L, ORG_ID)).thenReturn(List.of());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_laundryRole_returnsOnlyMemberTeams() {
            Jwt jwt = buildJwtWithRole("LAUNDRY");
            User laundry = buildUser(23L, "Laundry", "Test", "l@test.com");
            laundry.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(laundry));
            when(teamRepository.findByUserId(23L, ORG_ID)).thenReturn(List.of());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_exteriorTechRole_returnsOnlyMemberTeams() {
            Jwt jwt = buildJwtWithRole("EXTERIOR_TECH");
            User extTech = buildUser(24L, "Ext", "Tech", "et@test.com");
            extTech.setKeycloakId(KEYCLOAK_ID);

            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(extTech));
            when(teamRepository.findByUserId(24L, ORG_ID)).thenReturn(List.of());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_hostRole_returnsEmptyPage() {
            // HOST is not an operational role in the TeamService switch, so it falls to "other roles"
            Jwt jwt = buildJwtWithRole("HOST");

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_operationalRole_userNotFound_returnsEmpty() {
            Jwt jwt = buildJwtWithRole("HOUSEKEEPER");
            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

            Page<TeamDto> result = teamService.list(pageable, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void list_pagination_appliedCorrectly() {
            // Arrange - SUPER_ADMIN sees all, 3 teams but page size 2
            Jwt jwt = buildJwtWithRole("SUPER_ADMIN");
            Pageable smallPage = PageRequest.of(0, 2);
            Team team1 = buildTeam(1L, "Team 1");
            Team team2 = buildTeam(2L, "Team 2");
            Team team3 = buildTeam(3L, "Team 3");
            when(teamRepository.findAll()).thenReturn(List.of(team1, team2, team3));

            // Act
            Page<TeamDto> result = teamService.list(smallPage, jwt);

            // Assert
            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(3);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // delete()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class Delete {

        @Test
        void delete_notFound_throwsNotFoundException() {
            when(teamRepository.existsById(77L)).thenReturn(false);

            assertThatThrownBy(() -> teamService.delete(77L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("77");
        }

        @Test
        void delete_exists_deletesAndNotifies() {
            when(teamRepository.existsById(1L)).thenReturn(true);

            teamService.delete(1L);

            verify(teamRepository).deleteById(1L);
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.TEAM_DELETED), any(), any(), any());
        }

        @Test
        void delete_notificationFailure_doesNotPreventDeletion() {
            when(teamRepository.existsById(1L)).thenReturn(true);
            org.mockito.Mockito.doThrow(new RuntimeException("Kafka down"))
                    .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            // Should not throw
            teamService.delete(1L);

            verify(teamRepository).deleteById(1L);
        }
    }
}
