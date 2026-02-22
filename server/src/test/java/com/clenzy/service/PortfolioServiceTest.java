package com.clenzy.service;

import com.clenzy.dto.PortfolioDto;
import com.clenzy.model.Portfolio;
import com.clenzy.model.PortfolioClient;
import com.clenzy.model.PortfolioTeam;
import com.clenzy.model.TeamRole;
import com.clenzy.model.User;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PortfolioTeamRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        portfolioService = new PortfolioService(portfolioRepository, portfolioClientRepository,
                portfolioTeamRepository, propertyRepository, userRepository, notificationService, tenantContext);
    }

    private User buildUser(Long id, String firstName, String lastName) {
        User user = new User();
        user.setId(id);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        return user;
    }

    // ===== CREATE =====

    @Nested
    class CreatePortfolio {

        @Test
        void whenValidDto_thenCreatesPortfolio() {
            User manager = buildUser(1L, "John", "Manager");
            when(userRepository.findById(1L)).thenReturn(Optional.of(manager));
            when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(inv -> {
                Portfolio p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });

            PortfolioDto dto = new PortfolioDto(1L, "Mon Portfolio", "Description");
            PortfolioDto result = portfolioService.createPortfolio(dto);

            assertThat(result.getName()).isEqualTo("Mon Portfolio");
            verify(portfolioRepository).save(any(Portfolio.class));
        }

        @Test
        void whenManagerNotFound_thenThrows() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            PortfolioDto dto = new PortfolioDto(99L, "Portfolio", null);

            assertThatThrownBy(() -> portfolioService.createPortfolio(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Manager non");
        }
    }

    // ===== UPDATE =====

    @Nested
    class UpdatePortfolio {

        @Test
        void whenExists_thenUpdatesFields() {
            User manager = buildUser(1L, "John", "Manager");
            Portfolio portfolio = new Portfolio(manager, "Old", "Old desc");
            portfolio.setId(1L);
            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));
            when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(inv -> inv.getArgument(0));

            PortfolioDto dto = new PortfolioDto(1L, "New Name", "New Desc");
            dto.setIsActive(false);

            PortfolioDto result = portfolioService.updatePortfolio(1L, dto);

            assertThat(result.getName()).isEqualTo("New Name");
        }

        @Test
        void whenNotFound_thenThrows() {
            when(portfolioRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> portfolioService.updatePortfolio(99L, new PortfolioDto(1L, "x", null)))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== GET BY ID =====

    @Nested
    class GetPortfolioById {

        @Test
        void whenExists_thenReturnsDto() {
            User manager = buildUser(1L, "John", "Manager");
            Portfolio portfolio = new Portfolio(manager, "Portfolio 1", null);
            portfolio.setId(1L);
            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));

            PortfolioDto result = portfolioService.getPortfolioById(1L);

            assertThat(result.getName()).isEqualTo("Portfolio 1");
        }

        @Test
        void whenNotFound_thenThrows() {
            when(portfolioRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> portfolioService.getPortfolioById(99L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== ADD CLIENT =====

    @Nested
    class AddClientToPortfolio {

        @Test
        void whenClientAlreadyInPortfolio_thenThrows() {
            User manager = buildUser(1L, "M", "M");
            Portfolio portfolio = new Portfolio(manager, "P", null);
            portfolio.setId(1L);
            when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));

            User client = buildUser(2L, "C", "C");
            when(userRepository.findById(2L)).thenReturn(Optional.of(client));
            when(portfolioClientRepository.existsByPortfolioIdAndClientId(1L, 2L, ORG_ID)).thenReturn(true);

            assertThatThrownBy(() -> portfolioService.addClientToPortfolio(1L, 2L, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("dans ce portefeuille");
        }
    }

    // ===== FIND MANAGER FOR HOST =====

    @Nested
    class FindManagerForHost {

        @Test
        void whenNoPortfolioClient_thenThrows() {
            User host = buildUser(5L, "Host", "User");
            when(portfolioClientRepository.findByClientIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(List.of());

            assertThatThrownBy(() -> portfolioService.findManagerForHost(host))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun manager");
        }
    }

    // ===== FIND MANAGER FOR TEAM MEMBER =====

    @Nested
    class FindManagerForTeamMember {

        @Test
        void whenNoPortfolioTeam_thenThrows() {
            User teamMember = buildUser(5L, "Team", "Member");
            when(portfolioTeamRepository.findByTeamMemberIdAndIsActiveTrue(5L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> portfolioService.findManagerForTeamMember(teamMember))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun manager");
        }
    }

    // ===== REMOVE CLIENT =====

    @Nested
    class RemoveClientFromPortfolio {

        @Test
        void whenClientNotInPortfolio_thenThrows() {
            when(portfolioClientRepository.findByPortfolioIdAndClientId(1L, 2L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> portfolioService.removeClientFromPortfolio(1L, 2L))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
