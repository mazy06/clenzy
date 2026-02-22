package com.clenzy.service;

import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.dto.manager.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    private Property buildProperty(Long id, User owner) {
        Property property = new Property();
        property.setId(id);
        property.setName("Property " + id);
        property.setAddress("Address " + id);
        property.setCity("Paris");
        property.setOwner(owner);
        return property;
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

    private Portfolio buildPortfolio(Long id, User manager) {
        Portfolio portfolio = new Portfolio();
        portfolio.setId(id);
        portfolio.setName("Portefeuille " + id);
        portfolio.setManager(manager);
        portfolio.setIsActive(true);
        portfolio.setClients(new ArrayList<>());
        portfolio.setTeamMembers(new ArrayList<>());
        return portfolio;
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("resolveManagerId(managerId)")
    class ResolveManagerId {

        @Test
        @DisplayName("numeric ID string returns the parsed Long")
        void whenNumericId_thenReturnsLong() {
            // Arrange & Act
            Optional<Long> result = managerService.resolveManagerId("42");

            // Assert
            assertThat(result).contains(42L);
        }

        @Test
        @DisplayName("keycloak UUID falls back to user lookup by keycloakId")
        void whenKeycloakUuid_thenLooksUpByKeycloakId() {
            // Arrange
            User user = buildUser(42L, UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-uuid-123")).thenReturn(Optional.of(user));

            // Act
            Optional<Long> result = managerService.resolveManagerId("kc-uuid-123");

            // Assert
            assertThat(result).contains(42L);
        }

        @Test
        @DisplayName("unknown keycloak UUID returns empty Optional")
        void whenKeycloakUuidNotFound_thenReturnsEmpty() {
            // Arrange
            when(userRepository.findByKeycloakId("unknown-uuid")).thenReturn(Optional.empty());

            // Act
            Optional<Long> result = managerService.resolveManagerId("unknown-uuid");

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("validateManagerOwnership(jwt, targetManagerId)")
    class ValidateManagerOwnership {

        @Test
        @DisplayName("SUPER_ADMIN bypasses ownership check")
        void whenSuperAdmin_thenAccessGranted() {
            // Arrange
            Jwt jwt = buildJwt("kc-admin", "SUPER_ADMIN");

            // Act & Assert (should not throw)
            managerService.validateManagerOwnership(jwt, 999L);
        }

        @Test
        @DisplayName("owner of the manager ID passes validation")
        void whenOwner_thenAccessGranted() {
            // Arrange
            Jwt jwt = buildJwt("kc-10");
            User user = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-10")).thenReturn(Optional.of(user));

            // Act & Assert (should not throw)
            managerService.validateManagerOwnership(jwt, MANAGER_ID);
        }

        @Test
        @DisplayName("non-owner and non-admin throws AccessDeniedException")
        void whenNotOwnerAndNotAdmin_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-other");
            User otherUser = buildUser(99L, UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(otherUser));

            // Act & Assert
            assertThatThrownBy(() -> managerService.validateManagerOwnership(jwt, MANAGER_ID))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("user not found in DB throws AccessDeniedException")
        void whenUserNotFound_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-unknown");
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> managerService.validateManagerOwnership(jwt, MANAGER_ID))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("getAllManagersAndAdmins()")
    class GetAllManagersAndAdmins {

        @Test
        @DisplayName("returns summary DTOs for all SUPER_ADMIN and SUPER_MANAGER users")
        void whenCalled_thenReturnsCorrectSummaries() {
            // Arrange
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            User manager = buildUser(2L, UserRole.SUPER_MANAGER);
            when(userRepository.findByRoleIn(any(), eq(ORG_ID)))
                    .thenReturn(List.of(admin, manager));

            // Act
            List<ManagerUserSummaryDto> result = managerService.getAllManagersAndAdmins();

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).id()).isEqualTo(1L);
            assertThat(result.get(1).id()).isEqualTo(2L);
        }
    }

    @Nested
    @DisplayName("getAvailableHostSummaries()")
    class GetAvailableHostSummaries {

        @Test
        @DisplayName("returns HOST users with unassigned properties as summaries")
        void whenHostsWithUnassignedProperties_thenReturnsSummaries() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property prop = buildProperty(100L, host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(false);

            // Act
            List<ManagerUserSummaryDto> result = managerService.getAvailableHostSummaries();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(20L);
            assertThat(result.get(0).role()).isEqualTo("HOST");
        }

        @Test
        @DisplayName("excludes hosts with all properties assigned")
        void whenAllPropertiesAssigned_thenExcludesHost() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property prop = buildProperty(100L, host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(true);

            // Act
            List<ManagerUserSummaryDto> result = managerService.getAvailableHostSummaries();

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getPropertiesByClients(clientIds)")
    class GetPropertiesByClients {

        @Test
        @DisplayName("returns unassigned properties for given client IDs")
        void whenUnassignedPropertiesExist_thenReturnsPropertyDtos() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property assigned = buildProperty(1L, host);
            Property unassigned = buildProperty(2L, host);

            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(assigned, unassigned));
            when(managerPropertyRepository.existsByPropertyId(1L, ORG_ID)).thenReturn(true);
            when(managerPropertyRepository.existsByPropertyId(2L, ORG_ID)).thenReturn(false);

            // Act
            List<PropertyByClientDto> result = managerService.getPropertiesByClients(List.of(20L));

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(2L);
            assertThat(result.get(0).ownerId()).isEqualTo(20L);
        }

        @Test
        @DisplayName("returns empty list when all properties are assigned")
        void whenAllAssigned_thenReturnsEmptyList() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property prop = buildProperty(1L, host);

            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(1L, ORG_ID)).thenReturn(true);

            // Act
            List<PropertyByClientDto> result = managerService.getPropertiesByClients(List.of(20L));

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("assignClientsAndProperties(managerId, request)")
    class AssignClientsAndProperties {

        @Test
        @DisplayName("creates portfolio if not exists, assigns clients and properties")
        void whenNewManager_thenCreatesPortfolioAndAssigns() {
            // Arrange
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            User client = buildUser(20L, UserRole.HOST);
            Property property = buildProperty(100L, client);

            when(userRepository.findById(MANAGER_ID)).thenReturn(Optional.of(manager));
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of());

            Portfolio newPortfolio = buildPortfolio(1L, manager);
            when(portfolioRepository.save(any(Portfolio.class))).thenReturn(newPortfolio);

            when(portfolioClientRepository.existsByPortfolioIdAndClientId(1L, 20L, ORG_ID)).thenReturn(false);
            when(userRepository.findById(20L)).thenReturn(Optional.of(client));
            when(portfolioClientRepository.save(any(PortfolioClient.class))).thenAnswer(inv -> inv.getArgument(0));

            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(managerPropertyRepository.existsByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID)).thenReturn(false);
            when(managerPropertyRepository.save(any(ManagerProperty.class))).thenAnswer(inv -> inv.getArgument(0));

            AssignmentRequest request = new AssignmentRequest(List.of(20L), List.of(100L));

            // Act
            AssignmentResultDto result = managerService.assignClientsAndProperties(MANAGER_ID, request);

            // Assert
            assertThat(result.message()).contains("reussie");
            assertThat(result.clientsAssigned()).isEqualTo(1);
            assertThat(result.propertiesAssigned()).isEqualTo(1);
            assertThat(result.portfolioId()).isEqualTo(1L);
            verify(portfolioRepository).save(any(Portfolio.class));
        }

        @Test
        @DisplayName("reuses existing portfolio instead of creating new one")
        void whenPortfolioExists_thenReusesIt() {
            // Arrange
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            Portfolio existingPortfolio = buildPortfolio(1L, manager);

            when(userRepository.findById(MANAGER_ID)).thenReturn(Optional.of(manager));
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(existingPortfolio));

            AssignmentRequest request = new AssignmentRequest(List.of(), List.of());

            // Act
            AssignmentResultDto result = managerService.assignClientsAndProperties(MANAGER_ID, request);

            // Assert
            assertThat(result.portfolioId()).isEqualTo(1L);
            verify(portfolioRepository, never()).save(any(Portfolio.class));
        }

        @Test
        @DisplayName("when manager not found - throws IllegalArgumentException")
        void whenManagerNotFound_thenThrows() {
            // Arrange
            when(userRepository.findById(999L)).thenReturn(Optional.empty());
            AssignmentRequest request = new AssignmentRequest(List.of(), List.of());

            // Act & Assert
            assertThatThrownBy(() -> managerService.assignClientsAndProperties(999L, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non trouve");
        }
    }

    @Nested
    @DisplayName("unassignClient(managerId, clientId)")
    class UnassignClient {

        @Test
        @DisplayName("deletes portfolio-client association")
        void whenClientAssigned_thenDeletesAssociation() {
            // Arrange
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(1L, manager);
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(portfolio));

            PortfolioClient pc = new PortfolioClient(portfolio, buildUser(20L, UserRole.HOST));
            when(portfolioClientRepository.findByPortfolioIdAndClientId(1L, 20L, ORG_ID))
                    .thenReturn(Optional.of(pc));

            // Act
            UnassignmentResultDto result = managerService.unassignClient(MANAGER_ID, 20L);

            // Assert
            assertThat(result.removedCount()).isEqualTo(1);
            assertThat(result.message()).contains("desassigne");
            verify(portfolioClientRepository).delete(pc);
        }

        @Test
        @DisplayName("when no portfolio found - throws IllegalArgumentException")
        void whenNoPortfolio_thenThrows() {
            // Arrange
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of());

            // Act & Assert
            assertThatThrownBy(() -> managerService.unassignClient(MANAGER_ID, 20L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non trouve");
        }

        @Test
        @DisplayName("when client not assigned - throws IllegalArgumentException")
        void whenClientNotAssigned_thenThrows() {
            // Arrange
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(1L, manager);
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(portfolio));
            when(portfolioClientRepository.findByPortfolioIdAndClientId(1L, 20L, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> managerService.unassignClient(MANAGER_ID, 20L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non assigne");
        }
    }

    @Nested
    @DisplayName("assignPropertyToManager(managerId, propertyId)")
    class AssignPropertyToManager {

        @Test
        @DisplayName("creates manager-property association when host is in portfolio")
        void whenHostIsInPortfolio_thenCreatesAssociation() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property property = buildProperty(100L, host);
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);

            Portfolio portfolio = buildPortfolio(1L, manager);
            PortfolioClient pc = new PortfolioClient(portfolio, host);
            portfolio.setClients(List.of(pc));

            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(portfolio));
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(null);
            when(managerPropertyRepository.save(any(ManagerProperty.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            PropertyAssignmentResultDto result = managerService.assignPropertyToManager(MANAGER_ID, 100L);

            // Assert
            assertThat(result.propertyId()).isEqualTo(100L);
            assertThat(result.message()).contains("reassignee");
            verify(managerPropertyRepository).save(any(ManagerProperty.class));
        }

        @Test
        @DisplayName("when property not found - throws IllegalArgumentException")
        void whenPropertyNotFound_thenThrows() {
            // Arrange
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> managerService.assignPropertyToManager(MANAGER_ID, 999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        @DisplayName("when host is not in manager's portfolio - throws IllegalArgumentException")
        void whenHostNotInPortfolio_thenThrows() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property property = buildProperty(100L, host);

            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of());

            // Act & Assert
            assertThatThrownBy(() -> managerService.assignPropertyToManager(MANAGER_ID, 100L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("n'est pas assigne");
        }

        @Test
        @DisplayName("when association already exists - does not create duplicate")
        void whenAlreadyAssigned_thenDoesNotDuplicate() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property property = buildProperty(100L, host);
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);

            Portfolio portfolio = buildPortfolio(1L, manager);
            PortfolioClient pc = new PortfolioClient(portfolio, host);
            portfolio.setClients(List.of(pc));

            ManagerProperty existingMp = new ManagerProperty(MANAGER_ID, 100L, "existing");

            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(portfolio));
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(existingMp);

            // Act
            PropertyAssignmentResultDto result = managerService.assignPropertyToManager(MANAGER_ID, 100L);

            // Assert
            assertThat(result.propertyId()).isEqualTo(100L);
            verify(managerPropertyRepository, never()).save(any(ManagerProperty.class));
        }
    }

    @Nested
    @DisplayName("getManagerAssociations(managerId)")
    class GetManagerAssociations {

        @Test
        @DisplayName("builds complete association DTO with clients, properties, teams, users")
        void whenAssociationsExist_thenReturnsCompleteDto() {
            // Arrange
            User manager = buildUser(MANAGER_ID, UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(1L, manager);

            // Empty clients/team members on portfolio (to avoid NPE)
            portfolio.setClients(new ArrayList<>());
            portfolio.setTeamMembers(new ArrayList<>());

            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(portfolio));

            // Direct manager-user associations
            ManagerUser mu = new ManagerUser(MANAGER_ID, 30L);
            User directUser = buildUser(30L, UserRole.TECHNICIAN);
            when(managerUserRepository.findByManagerIdAndIsActiveTrue(MANAGER_ID, ORG_ID))
                    .thenReturn(List.of(mu));
            when(userRepository.findById(30L)).thenReturn(Optional.of(directUser));

            // Manager-property associations
            ManagerProperty mp = new ManagerProperty(MANAGER_ID, 100L, "test");
            User host = buildUser(20L, UserRole.HOST);
            Property property = buildProperty(100L, host);
            when(managerPropertyRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of(mp));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

            // Manager-team associations
            ManagerTeam mt = new ManagerTeam(MANAGER_ID, 5L);
            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe A");
            team.setDescription("Description");
            when(managerTeamRepository.findByManagerIdAndIsActiveTrue(MANAGER_ID, ORG_ID)).thenReturn(List.of(mt));
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

            // Act
            ManagerAssociationsDto result = managerService.getManagerAssociations(MANAGER_ID);

            // Assert
            assertThat(result.getClients()).isEmpty();
            assertThat(result.getProperties()).hasSize(1);
            assertThat(result.getTeams()).hasSize(1);
            assertThat(result.getUsers()).hasSize(1);
            assertThat(result.getProperties().get(0).getId()).isEqualTo(100L);
            assertThat(result.getTeams().get(0).getId()).isEqualTo(5L);
            assertThat(result.getUsers().get(0).getId()).isEqualTo(30L);
        }

        @Test
        @DisplayName("returns empty associations when nothing is assigned")
        void whenNoAssociations_thenReturnsEmptyDto() {
            // Arrange
            when(portfolioRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of());
            when(managerUserRepository.findByManagerIdAndIsActiveTrue(MANAGER_ID, ORG_ID)).thenReturn(List.of());
            when(managerPropertyRepository.findByManagerId(MANAGER_ID, ORG_ID)).thenReturn(List.of());
            when(managerTeamRepository.findByManagerIdAndIsActiveTrue(MANAGER_ID, ORG_ID)).thenReturn(List.of());

            // Act
            ManagerAssociationsDto result = managerService.getManagerAssociations(MANAGER_ID);

            // Assert
            assertThat(result.getClients()).isEmpty();
            assertThat(result.getProperties()).isEmpty();
            assertThat(result.getTeams()).isEmpty();
            assertThat(result.getUsers()).isEmpty();
        }
    }

    // ── Existing tests preserved with @DisplayName ──────────────────────────

    @Nested
    @DisplayName("Listing endpoints")
    class ListingEndpoints {

        @Test
        @DisplayName("getOperationalUsers filters for TECHNICIAN, HOUSEKEEPER etc.")
        void getOperationalUsers_filtersCorrectRoles() {
            // Arrange
            User tech = buildUser(3L, UserRole.TECHNICIAN);
            User hk = buildUser(4L, UserRole.HOUSEKEEPER);
            when(userRepository.findByRoleIn(any(), eq(ORG_ID)))
                    .thenReturn(List.of(tech, hk));

            // Act
            List<ManagerUserSummaryDto> result = managerService.getOperationalUsers();

            // Assert
            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("getAllTeamSummaries returns all teams with truncated descriptions")
        void getAllTeamSummaries_returnsAllTeams() {
            // Arrange
            Team team = new Team();
            team.setId(1L);
            team.setName("Team A");
            team.setDescription("A very long description that exceeds fifty characters limit for testing truncation");
            when(teamRepository.findAll()).thenReturn(List.of(team));

            // Act
            List<ManagerTeamSummaryDto> result = managerService.getAllTeamSummaries();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Team A");
            assertThat(result.get(0).description()).hasSizeLessThanOrEqualTo(50);
        }
    }

    @Nested
    @DisplayName("assignTeamsAndUsers(managerId, request)")
    class AssignTeamsAndUsers {

        @Test
        @DisplayName("assigns new teams and users")
        void whenNewTeamsAndUsers_thenAssignsAll() {
            // Arrange
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    eq(MANAGER_ID), anyLong(), eq(ORG_ID))).thenReturn(false);
            when(managerUserRepository.existsByManagerIdAndUserIdAndIsActiveTrue(
                    eq(MANAGER_ID), anyLong(), eq(ORG_ID))).thenReturn(false);
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(managerUserRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest(
                    MANAGER_ID, List.of(1L, 2L), List.of(3L, 4L));

            // Act
            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            // Assert
            assertThat(result.message()).contains("reussie");
            assertThat(result.teamsAssigned()).isEqualTo(2);
            assertThat(result.usersAssigned()).isEqualTo(2);
        }

        @Test
        @DisplayName("skips already-assigned teams")
        void whenTeamAlreadyAssigned_thenSkipsIt() {
            // Arrange
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    MANAGER_ID, 1L, ORG_ID)).thenReturn(true);
            when(managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(
                    MANAGER_ID, 2L, ORG_ID)).thenReturn(false);
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest(
                    MANAGER_ID, List.of(1L, 2L), List.of());

            // Act
            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            // Assert
            assertThat(result.teamsAssigned()).isEqualTo(1);
        }

        @Test
        @DisplayName("null lists result in zero assignments")
        void whenNullLists_thenAssignsNothing() {
            // Arrange
            TeamUserAssignmentRequest request = new TeamUserAssignmentRequest();

            // Act
            TeamUserAssignmentResultDto result = managerService.assignTeamsAndUsers(MANAGER_ID, request);

            // Assert
            assertThat(result.teamsAssigned()).isZero();
            assertThat(result.usersAssigned()).isZero();
        }
    }

    @Nested
    @DisplayName("unassignTeam(managerId, teamId)")
    class UnassignTeam {

        @Test
        @DisplayName("soft-deletes team association")
        void whenTeamAssigned_thenSoftDeletesAssociation() {
            // Arrange
            ManagerTeam mt = new ManagerTeam(MANAGER_ID, 1L);
            mt.setId(100L);
            when(managerTeamRepository.findAllByManagerIdAndTeamId(MANAGER_ID, 1L, ORG_ID))
                    .thenReturn(List.of(mt));
            when(managerTeamRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            UnassignmentResultDto result = managerService.unassignTeam(MANAGER_ID, 1L);

            // Assert
            assertThat(result.removedCount()).isEqualTo(1);

            ArgumentCaptor<ManagerTeam> captor = ArgumentCaptor.forClass(ManagerTeam.class);
            verify(managerTeamRepository).save(captor.capture());
            assertThat(captor.getValue().getIsActive()).isFalse();
        }

        @Test
        @DisplayName("returns zero count when no association exists")
        void whenNoAssociation_thenReturnsZeroCount() {
            // Arrange
            when(managerTeamRepository.findAllByManagerIdAndTeamId(MANAGER_ID, 1L, ORG_ID))
                    .thenReturn(List.of());

            // Act
            UnassignmentResultDto result = managerService.unassignTeam(MANAGER_ID, 1L);

            // Assert
            assertThat(result.removedCount()).isZero();
        }
    }

    @Nested
    @DisplayName("unassignUser(managerId, userId)")
    class UnassignUser {

        @Test
        @DisplayName("soft-deletes user association")
        void whenUserAssigned_thenSoftDeletesAssociation() {
            // Arrange
            ManagerUser mu = new ManagerUser(MANAGER_ID, 5L);
            mu.setId(200L);
            when(managerUserRepository.findAllByManagerIdAndUserId(MANAGER_ID, 5L, ORG_ID))
                    .thenReturn(List.of(mu));
            when(managerUserRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            UnassignmentResultDto result = managerService.unassignUser(MANAGER_ID, 5L);

            // Assert
            assertThat(result.removedCount()).isEqualTo(1);
            ArgumentCaptor<ManagerUser> captor = ArgumentCaptor.forClass(ManagerUser.class);
            verify(managerUserRepository).save(captor.capture());
            assertThat(captor.getValue().getIsActive()).isFalse();
        }
    }

    @Nested
    @DisplayName("getAvailableHosts()")
    class AvailableHosts {

        @Test
        @DisplayName("includes host with unassigned properties")
        void whenHostHasUnassignedProperty_thenIncluded() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property prop = buildProperty(100L, host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(false);

            // Act
            List<User> result = managerService.getAvailableHosts();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(20L);
        }

        @Test
        @DisplayName("excludes host when all properties are assigned")
        void whenHostHasAllPropertiesAssigned_thenExcluded() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);
            Property prop = buildProperty(100L, host);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(prop));
            when(managerPropertyRepository.existsByPropertyId(100L, ORG_ID)).thenReturn(true);

            // Act
            List<User> result = managerService.getAvailableHosts();

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("includes host with no properties at all")
        void whenHostHasNoProperties_thenIncluded() {
            // Arrange
            User host = buildUser(20L, UserRole.HOST);

            when(userRepository.findByRoleIn(any(), eq(ORG_ID))).thenReturn(List.of(host));
            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of());

            // Act
            List<User> result = managerService.getAvailableHosts();

            // Assert
            assertThat(result).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getAvailablePropertiesForHost(hostId)")
    class AvailablePropertiesForHost {

        @Test
        @DisplayName("returns only unassigned properties")
        void whenSomePropertiesUnassigned_thenReturnsOnlyUnassigned() {
            // Arrange
            Property assigned = buildProperty(1L, buildUser(20L, UserRole.HOST));
            Property unassigned = buildProperty(2L, buildUser(20L, UserRole.HOST));

            when(propertyRepository.findByOwnerId(20L)).thenReturn(List.of(assigned, unassigned));
            when(managerPropertyRepository.existsByPropertyId(1L, ORG_ID)).thenReturn(true);
            when(managerPropertyRepository.existsByPropertyId(2L, ORG_ID)).thenReturn(false);

            // Act
            List<Property> result = managerService.getAvailablePropertiesForHost(20L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(2L);
        }
    }

    @Nested
    @DisplayName("unassignPropertyFromManager(managerId, propertyId)")
    class UnassignProperty {

        @Test
        @DisplayName("deletes the manager-property association")
        void whenPropertyAssigned_thenDeletesAssociation() {
            // Arrange
            Property property = buildProperty(100L, buildUser(20L, UserRole.HOST));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

            ManagerProperty mp = new ManagerProperty(MANAGER_ID, 100L, "test");
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(mp);

            // Act
            PropertyAssignmentResultDto result = managerService.unassignPropertyFromManager(MANAGER_ID, 100L);

            // Assert
            assertThat(result.propertyId()).isEqualTo(100L);
            verify(managerPropertyRepository).delete(mp);
        }

        @Test
        @DisplayName("when property not found - throws IllegalArgumentException")
        void whenPropertyNotFound_thenThrowsIllegalArgument() {
            // Arrange
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> managerService.unassignPropertyFromManager(MANAGER_ID, 999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        @DisplayName("when property not assigned to manager - throws IllegalArgumentException")
        void whenPropertyNotAssigned_thenThrowsIllegalArgument() {
            // Arrange
            Property property = buildProperty(100L, buildUser(20L, UserRole.HOST));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(managerPropertyRepository.findByManagerIdAndPropertyId(MANAGER_ID, 100L, ORG_ID))
                    .thenReturn(null);

            // Act & Assert
            assertThatThrownBy(() -> managerService.unassignPropertyFromManager(MANAGER_ID, 100L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non assignee");
        }
    }
}
