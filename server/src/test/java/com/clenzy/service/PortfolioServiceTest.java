package com.clenzy.service;

import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioStatsDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock private PortfolioRepository portfolioRepository;
    @Mock private PortfolioClientRepository portfolioClientRepository;
    @Mock private PortfolioTeamRepository portfolioTeamRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    private TenantContext tenantContext;
    private PortfolioService portfolioService;
    private static final Long ORG_ID = 1L;

    @Captor private ArgumentCaptor<Portfolio> portfolioCaptor;
    @Captor private ArgumentCaptor<PortfolioClient> portfolioClientCaptor;
    @Captor private ArgumentCaptor<PortfolioTeam> portfolioTeamCaptor;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        portfolioService = new PortfolioService(portfolioRepository, portfolioClientRepository,
                portfolioTeamRepository, propertyRepository, userRepository, notificationService, tenantContext);
    }

    private User buildUser(Long id, String firstName, String lastName, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(firstName.toLowerCase() + "@test.com");
        user.setRole(role);
        return user;
    }

    private Portfolio buildPortfolio(Long id, User manager, String name) {
        Portfolio portfolio = new Portfolio(manager, name, "Description");
        portfolio.setId(id);
        portfolio.setIsActive(true);
        portfolio.setClients(new ArrayList<>());
        portfolio.setTeamMembers(new ArrayList<>());
        return portfolio;
    }

    private PortfolioClient buildPortfolioClient(Long id, Portfolio portfolio, User client) {
        PortfolioClient pc = new PortfolioClient(portfolio, client);
        pc.setId(id);
        pc.setAssignedAt(LocalDateTime.now());
        pc.setIsActive(true);
        return pc;
    }

    private PortfolioTeam buildPortfolioTeam(Long id, Portfolio portfolio, User member, TeamRole role) {
        PortfolioTeam pt = new PortfolioTeam(portfolio, member, role);
        pt.setId(id);
        pt.setAssignedAt(LocalDateTime.now());
        pt.setIsActive(true);
        return pt;
    }

    // ===== CREATE =====

    @Nested
    @DisplayName("createPortfolio")
    class CreatePortfolio {

        @Test
        @DisplayName("should create portfolio and return DTO with correct manager name")
        void whenValidDto_thenCreatesPortfolio() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            when(userRepository.findById(1L)).thenReturn(Optional.of(manager));
            when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(inv -> {
                Portfolio p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });

            PortfolioDto dto = new PortfolioDto(1L, "Mon Portfolio", "Description");

            // Act
            PortfolioDto result = portfolioService.createPortfolio(dto);

            // Assert
            assertThat(result.getName()).isEqualTo("Mon Portfolio");
            assertThat(result.getManagerName()).isEqualTo("John Manager");
            verify(portfolioRepository).save(portfolioCaptor.capture());
            assertThat(portfolioCaptor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        @DisplayName("should throw when manager not found")
        void whenManagerNotFound_thenThrows() {
            // Arrange
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            PortfolioDto dto = new PortfolioDto(99L, "Portfolio", null);

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.createPortfolio(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Manager non");
        }

        @Test
        @DisplayName("should still create portfolio when notification fails")
        void whenNotificationFails_thenStillCreates() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            when(userRepository.findById(1L)).thenReturn(Optional.of(manager));
            when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(inv -> {
                Portfolio p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });
            doThrow(new RuntimeException("Notification error"))
                    .when(notificationService).notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());

            PortfolioDto dto = new PortfolioDto(1L, "Portfolio", null);

            // Act
            PortfolioDto result = portfolioService.createPortfolio(dto);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(10L);
        }
    }

    // ===== UPDATE =====

    @Nested
    @DisplayName("updatePortfolio")
    class UpdatePortfolio {

        @Test
        @DisplayName("should update name, description, and isActive")
        void whenExists_thenUpdatesFields() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(1L, manager, "Old");

            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));
            when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(inv -> inv.getArgument(0));

            PortfolioDto dto = new PortfolioDto(1L, "New Name", "New Desc");
            dto.setIsActive(false);

            // Act
            PortfolioDto result = portfolioService.updatePortfolio(1L, dto);

            // Assert
            assertThat(result.getName()).isEqualTo("New Name");
            verify(portfolioRepository).save(portfolioCaptor.capture());
            assertThat(portfolioCaptor.getValue().getDescription()).isEqualTo("New Desc");
            assertThat(portfolioCaptor.getValue().getIsActive()).isFalse();
        }

        @Test
        @DisplayName("should throw when portfolio not found")
        void whenNotFound_thenThrows() {
            // Arrange
            when(portfolioRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.updatePortfolio(99L, new PortfolioDto(1L, "x", null)))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== GET BY ID =====

    @Nested
    @DisplayName("getPortfolioById")
    class GetPortfolioById {

        @Test
        @DisplayName("should return DTO when portfolio exists")
        void whenExists_thenReturnsDto() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(1L, manager, "Portfolio 1");
            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));

            // Act
            PortfolioDto result = portfolioService.getPortfolioById(1L);

            // Assert
            assertThat(result.getName()).isEqualTo("Portfolio 1");
            assertThat(result.getId()).isEqualTo(1L);
        }

        @Test
        @DisplayName("should throw when portfolio not found")
        void whenNotFound_thenThrows() {
            // Arrange
            when(portfolioRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.getPortfolioById(99L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== GET BY MANAGER =====

    @Nested
    @DisplayName("getPortfoliosByManager")
    class GetPortfoliosByManager {

        @Test
        @DisplayName("should return list of DTOs for manager")
        void whenManagerHasPortfolios_thenReturnsList() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            Portfolio p1 = buildPortfolio(10L, manager, "Portfolio A");
            Portfolio p2 = buildPortfolio(11L, manager, "Portfolio B");

            when(portfolioRepository.findByManagerId(1L, ORG_ID)).thenReturn(List.of(p1, p2));

            // Act
            List<PortfolioDto> result = portfolioService.getPortfoliosByManager(1L);

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).getName()).isEqualTo("Portfolio A");
        }

        @Test
        @DisplayName("should return empty list when no portfolios")
        void whenNoPortfolios_thenReturnsEmpty() {
            // Arrange
            when(portfolioRepository.findByManagerId(1L, ORG_ID)).thenReturn(Collections.emptyList());

            // Act
            List<PortfolioDto> result = portfolioService.getPortfoliosByManager(1L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== GET ALL ACTIVE =====

    @Nested
    @DisplayName("getAllActivePortfolios")
    class GetAllActivePortfolios {

        @Test
        @DisplayName("should return only active portfolios")
        void whenActiveExists_thenReturnsThem() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            Portfolio active = buildPortfolio(10L, manager, "Active");
            when(portfolioRepository.findByIsActiveTrue(ORG_ID)).thenReturn(List.of(active));

            // Act
            List<PortfolioDto> result = portfolioService.getAllActivePortfolios();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Active");
        }
    }

    // ===== ADD CLIENT =====

    @Nested
    @DisplayName("addClientToPortfolio")
    class AddClientToPortfolio {

        @Test
        @DisplayName("should add client and return DTO with correct info")
        void whenClientNotInPortfolio_thenAddsAndReturns() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            User client = buildUser(2L, "Marie", "Martin", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");

            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(2L)).thenReturn(Optional.of(client));
            when(portfolioClientRepository.existsByPortfolioIdAndClientId(10L, 2L, ORG_ID)).thenReturn(false);
            when(portfolioClientRepository.save(any(PortfolioClient.class))).thenAnswer(inv -> {
                PortfolioClient pc = inv.getArgument(0);
                pc.setId(100L);
                return pc;
            });

            // Act
            PortfolioClientDto result = portfolioService.addClientToPortfolio(10L, 2L, "VIP");

            // Assert
            assertThat(result.getId()).isEqualTo(100L);
            assertThat(result.getClientName()).isEqualTo("Marie Martin");
            verify(portfolioClientRepository).save(portfolioClientCaptor.capture());
            assertThat(portfolioClientCaptor.getValue().getNotes()).isEqualTo("VIP");
            assertThat(portfolioClientCaptor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        @DisplayName("should throw when client already in portfolio")
        void whenClientAlreadyInPortfolio_thenThrows() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User client = buildUser(2L, "C", "C", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(1L, manager, "P");

            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(2L)).thenReturn(Optional.of(client));
            when(portfolioClientRepository.existsByPortfolioIdAndClientId(1L, 2L, ORG_ID)).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.addClientToPortfolio(1L, 2L, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("dans ce portefeuille");
        }

        @Test
        @DisplayName("should throw when portfolio not found")
        void whenPortfolioNotFound_thenThrows() {
            // Arrange
            when(portfolioRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.addClientToPortfolio(999L, 1L, null))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("should throw when client not found")
        void whenClientNotFound_thenThrows() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.addClientToPortfolio(10L, 999L, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Client non");
        }

        @Test
        @DisplayName("should still add client when notification fails")
        void whenNotificationFails_thenStillAdds() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User client = buildUser(2L, "C", "C", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");

            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(2L)).thenReturn(Optional.of(client));
            when(portfolioClientRepository.existsByPortfolioIdAndClientId(10L, 2L, ORG_ID)).thenReturn(false);
            when(portfolioClientRepository.save(any(PortfolioClient.class))).thenAnswer(inv -> {
                PortfolioClient pc = inv.getArgument(0);
                pc.setId(100L);
                return pc;
            });
            doThrow(new RuntimeException("Notification failed"))
                    .when(notificationService).notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());

            // Act
            PortfolioClientDto result = portfolioService.addClientToPortfolio(10L, 2L, null);

            // Assert
            assertThat(result).isNotNull();
        }
    }

    // ===== REMOVE CLIENT =====

    @Nested
    @DisplayName("removeClientFromPortfolio")
    class RemoveClientFromPortfolio {

        @Test
        @DisplayName("should delete the portfolio client entry")
        void whenClientInPortfolio_thenDeletes() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User client = buildUser(2L, "C", "C", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioClient pc = buildPortfolioClient(100L, portfolio, client);

            when(portfolioClientRepository.findByPortfolioIdAndClientId(10L, 2L, ORG_ID))
                    .thenReturn(Optional.of(pc));

            // Act
            portfolioService.removeClientFromPortfolio(10L, 2L);

            // Assert
            verify(portfolioClientRepository).delete(pc);
        }

        @Test
        @DisplayName("should throw when client not in portfolio")
        void whenClientNotInPortfolio_thenThrows() {
            // Arrange
            when(portfolioClientRepository.findByPortfolioIdAndClientId(1L, 2L, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.removeClientFromPortfolio(1L, 2L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== ADD TEAM MEMBER =====

    @Nested
    @DisplayName("addTeamMemberToPortfolio")
    class AddTeamMemberToPortfolio {

        @Test
        @DisplayName("should add team member with role and return DTO")
        void whenMemberNotInPortfolio_thenAddsAndReturns() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            User member = buildUser(3L, "Pierre", "Tech", UserRole.TECHNICIAN);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");

            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(3L)).thenReturn(Optional.of(member));
            when(portfolioTeamRepository.existsByPortfolioIdAndTeamMemberId(10L, 3L, ORG_ID)).thenReturn(false);
            when(portfolioTeamRepository.save(any(PortfolioTeam.class))).thenAnswer(inv -> {
                PortfolioTeam pt = inv.getArgument(0);
                pt.setId(200L);
                return pt;
            });

            // Act
            PortfolioTeamDto result = portfolioService.addTeamMemberToPortfolio(10L, 3L, TeamRole.TECHNICIAN, "Expert");

            // Assert
            assertThat(result.getId()).isEqualTo(200L);
            assertThat(result.getTeamMemberName()).isEqualTo("Pierre Tech");
            assertThat(result.getRoleInTeam()).isEqualTo(TeamRole.TECHNICIAN);
            verify(portfolioTeamRepository).save(portfolioTeamCaptor.capture());
            assertThat(portfolioTeamCaptor.getValue().getNotes()).isEqualTo("Expert");
            assertThat(portfolioTeamCaptor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        @DisplayName("should throw when member already in portfolio")
        void whenMemberAlreadyExists_thenThrows() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User member = buildUser(3L, "P", "T", UserRole.TECHNICIAN);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");

            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(3L)).thenReturn(Optional.of(member));
            when(portfolioTeamRepository.existsByPortfolioIdAndTeamMemberId(10L, 3L, ORG_ID)).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.addTeamMemberToPortfolio(10L, 3L, TeamRole.TECHNICIAN, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("dans ce portefeuille");
        }

        @Test
        @DisplayName("should throw when team member not found")
        void whenMemberNotFound_thenThrows() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            when(portfolioRepository.findById(10L)).thenReturn(Optional.of(portfolio));
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.addTeamMemberToPortfolio(10L, 999L, TeamRole.TECHNICIAN, null))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== REMOVE TEAM MEMBER =====

    @Nested
    @DisplayName("removeTeamMemberFromPortfolio")
    class RemoveTeamMemberFromPortfolio {

        @Test
        @DisplayName("should delete the portfolio team entry")
        void whenMemberInPortfolio_thenDeletes() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User member = buildUser(3L, "P", "T", UserRole.TECHNICIAN);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioTeam pt = buildPortfolioTeam(200L, portfolio, member, TeamRole.TECHNICIAN);

            when(portfolioTeamRepository.findByPortfolioIdAndTeamMemberId(10L, 3L, ORG_ID))
                    .thenReturn(Optional.of(pt));

            // Act
            portfolioService.removeTeamMemberFromPortfolio(10L, 3L);

            // Assert
            verify(portfolioTeamRepository).delete(pt);
        }

        @Test
        @DisplayName("should throw when member not in portfolio")
        void whenMemberNotInPortfolio_thenThrows() {
            // Arrange
            when(portfolioTeamRepository.findByPortfolioIdAndTeamMemberId(10L, 3L, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.removeTeamMemberFromPortfolio(10L, 3L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== FIND MANAGER FOR HOST =====

    @Nested
    @DisplayName("findManagerForHost")
    class FindManagerForHost {

        @Test
        @DisplayName("should return the manager of the first active portfolio")
        void whenHostInPortfolio_thenReturnsManager() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            User host = buildUser(5L, "Host", "User", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioClient pc = buildPortfolioClient(100L, portfolio, host);

            when(portfolioClientRepository.findByClientIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(List.of(pc));

            // Act
            User result = portfolioService.findManagerForHost(host);

            // Assert
            assertThat(result.getId()).isEqualTo(1L);
            assertThat(result.getFirstName()).isEqualTo("John");
        }

        @Test
        @DisplayName("should throw when host has no active portfolio")
        void whenNoPortfolioClient_thenThrows() {
            // Arrange
            User host = buildUser(5L, "Host", "User", UserRole.HOST);
            when(portfolioClientRepository.findByClientIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(List.of());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.findManagerForHost(host))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun manager");
        }
    }

    // ===== FIND MANAGER FOR TEAM MEMBER =====

    @Nested
    @DisplayName("findManagerForTeamMember")
    class FindManagerForTeamMember {

        @Test
        @DisplayName("should return the manager of the active portfolio")
        void whenMemberInPortfolio_thenReturnsManager() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            User member = buildUser(5L, "Team", "Member", UserRole.TECHNICIAN);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioTeam pt = buildPortfolioTeam(200L, portfolio, member, TeamRole.TECHNICIAN);

            when(portfolioTeamRepository.findByTeamMemberIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(Optional.of(pt));

            // Act
            User result = portfolioService.findManagerForTeamMember(member);

            // Assert
            assertThat(result.getId()).isEqualTo(1L);
        }

        @Test
        @DisplayName("should throw when team member has no active portfolio")
        void whenNoPortfolioTeam_thenThrows() {
            // Arrange
            User member = buildUser(5L, "Team", "Member", UserRole.TECHNICIAN);
            when(portfolioTeamRepository.findByTeamMemberIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> portfolioService.findManagerForTeamMember(member))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun manager");
        }
    }

    // ===== GET PORTFOLIO CLIENTS =====

    @Nested
    @DisplayName("getPortfolioClients")
    class GetPortfolioClients {

        @Test
        @DisplayName("should return list of client DTOs")
        void whenClientsExist_thenReturnsList() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User client = buildUser(2L, "Marie", "Martin", UserRole.HOST);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioClient pc = buildPortfolioClient(100L, portfolio, client);

            when(portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(List.of(pc));

            // Act
            List<PortfolioClientDto> result = portfolioService.getPortfolioClients(10L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getClientName()).isEqualTo("Marie Martin");
        }

        @Test
        @DisplayName("should return empty list when no clients")
        void whenNoClients_thenReturnsEmpty() {
            // Arrange
            when(portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(Collections.emptyList());

            // Act
            List<PortfolioClientDto> result = portfolioService.getPortfolioClients(10L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== GET PORTFOLIO TEAM MEMBERS =====

    @Nested
    @DisplayName("getPortfolioTeamMembers")
    class GetPortfolioTeamMembers {

        @Test
        @DisplayName("should return list of team DTOs")
        void whenTeamMembersExist_thenReturnsList() {
            // Arrange
            User manager = buildUser(1L, "M", "M", UserRole.SUPER_MANAGER);
            User member = buildUser(3L, "Pierre", "Tech", UserRole.TECHNICIAN);
            Portfolio portfolio = buildPortfolio(10L, manager, "Test");
            PortfolioTeam pt = buildPortfolioTeam(200L, portfolio, member, TeamRole.TECHNICIAN);

            when(portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(List.of(pt));

            // Act
            List<PortfolioTeamDto> result = portfolioService.getPortfolioTeamMembers(10L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getTeamMemberName()).isEqualTo("Pierre Tech");
            assertThat(result.get(0).getRoleInTeam()).isEqualTo(TeamRole.TECHNICIAN);
        }
    }

    // ===== GET STATS BY MANAGER =====

    @Nested
    @DisplayName("getStatsByManager")
    class GetStatsByManager {

        @Test
        @DisplayName("should compute correct stats with active and inactive portfolios")
        void whenManagerHasPortfolios_thenComputesStats() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            User client1 = buildUser(2L, "Marie", "Martin", UserRole.HOST);
            User client2 = buildUser(3L, "Pierre", "Leroy", UserRole.HOST);
            User teamMember = buildUser(4L, "Alice", "Tech", UserRole.TECHNICIAN);

            Portfolio activeP = buildPortfolio(10L, manager, "Active");
            activeP.setIsActive(true);
            Portfolio inactiveP = buildPortfolio(11L, manager, "Inactive");
            inactiveP.setIsActive(false);

            when(portfolioRepository.findByManagerId(1L, ORG_ID)).thenReturn(List.of(activeP, inactiveP));

            PortfolioClient pc1 = buildPortfolioClient(100L, activeP, client1);
            PortfolioClient pc2 = buildPortfolioClient(101L, activeP, client2);
            when(portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(List.of(pc1, pc2));
            when(portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(11L, ORG_ID))
                    .thenReturn(Collections.emptyList());

            Property prop1 = new Property();
            prop1.setId(50L);
            when(propertyRepository.findByOwnerId(2L)).thenReturn(List.of(prop1));
            when(propertyRepository.findByOwnerId(3L)).thenReturn(Collections.emptyList());

            PortfolioTeam pt = buildPortfolioTeam(200L, activeP, teamMember, TeamRole.TECHNICIAN);
            when(portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID))
                    .thenReturn(List.of(pt));
            when(portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(11L, ORG_ID))
                    .thenReturn(Collections.emptyList());

            // Act
            PortfolioStatsDto stats = portfolioService.getStatsByManager(1L);

            // Assert
            assertThat(stats.getTotalPortfolios()).isEqualTo(2);
            assertThat(stats.getActivePortfolios()).isEqualTo(1);
            assertThat(stats.getInactivePortfolios()).isEqualTo(1);
            assertThat(stats.getTotalClients()).isEqualTo(2);
            assertThat(stats.getTotalProperties()).isEqualTo(1);
            assertThat(stats.getTotalTeamMembers()).isEqualTo(1);
            assertThat(stats.getPortfolioBreakdown()).hasSize(2);
            assertThat(stats.getRecentAssignments()).hasSizeLessThanOrEqualTo(10);
        }

        @Test
        @DisplayName("should return zero stats when no portfolios")
        void whenNoPortfolios_thenReturnsZeroStats() {
            // Arrange
            when(portfolioRepository.findByManagerId(1L, ORG_ID)).thenReturn(Collections.emptyList());

            // Act
            PortfolioStatsDto stats = portfolioService.getStatsByManager(1L);

            // Assert
            assertThat(stats.getTotalPortfolios()).isZero();
            assertThat(stats.getTotalClients()).isZero();
            assertThat(stats.getTotalProperties()).isZero();
            assertThat(stats.getTotalTeamMembers()).isZero();
            assertThat(stats.getPortfolioBreakdown()).isEmpty();
            assertThat(stats.getRecentAssignments()).isEmpty();
        }

        @Test
        @DisplayName("should limit recent assignments to 10")
        void whenManyAssignments_thenLimitsToTen() {
            // Arrange
            User manager = buildUser(1L, "John", "Manager", UserRole.SUPER_MANAGER);
            Portfolio portfolio = buildPortfolio(10L, manager, "Big");
            portfolio.setIsActive(true);

            when(portfolioRepository.findByManagerId(1L, ORG_ID)).thenReturn(List.of(portfolio));

            // Create 15 clients
            List<PortfolioClient> clients = new ArrayList<>();
            for (int i = 0; i < 15; i++) {
                User c = buildUser((long) (100 + i), "Client" + i, "Last" + i, UserRole.HOST);
                PortfolioClient pc = buildPortfolioClient((long) (200 + i), portfolio, c);
                pc.setAssignedAt(LocalDateTime.now().minusDays(i));
                clients.add(pc);
            }
            when(portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID)).thenReturn(clients);
            when(portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(10L, ORG_ID)).thenReturn(Collections.emptyList());

            // Properties for each client
            for (int i = 0; i < 15; i++) {
                when(propertyRepository.findByOwnerId(100L + i)).thenReturn(Collections.emptyList());
            }

            // Act
            PortfolioStatsDto stats = portfolioService.getStatsByManager(1L);

            // Assert
            assertThat(stats.getRecentAssignments()).hasSize(10);
        }
    }
}
