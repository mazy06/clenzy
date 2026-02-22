package com.clenzy.controller;

import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioStatsDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.TeamRole;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PortfolioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioControllerTest {

    @Mock private PortfolioService portfolioService;
    @Mock private UserRepository userRepository;

    private PortfolioController controller;

    private Jwt createJwt(String... roles) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("realm_access", Map.of("roles", List.of(roles)))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new PortfolioController(portfolioService, userRepository);
    }

    @Nested
    @DisplayName("createPortfolio")
    class Create {
        @Test
        void whenSuccess_thenReturnsOk() {
            PortfolioDto dto = new PortfolioDto();
            PortfolioDto created = new PortfolioDto();
            when(portfolioService.createPortfolio(any())).thenReturn(created);

            ResponseEntity<PortfolioDto> response = controller.createPortfolio(dto, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenBadRequest() {
            when(portfolioService.createPortfolio(any())).thenThrow(new RuntimeException());

            ResponseEntity<PortfolioDto> response = controller.createPortfolio(new PortfolioDto(), createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("updatePortfolio")
    class Update {
        @Test
        void whenSuccess_thenReturnsOk() {
            PortfolioDto updated = new PortfolioDto();
            when(portfolioService.updatePortfolio(eq(1L), any())).thenReturn(updated);

            ResponseEntity<PortfolioDto> response = controller.updatePortfolio(1L, new PortfolioDto(), createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getPortfolioById")
    class GetById {
        @Test
        void whenExists_thenReturnsOk() {
            PortfolioDto dto = new PortfolioDto();
            when(portfolioService.getPortfolioById(1L)).thenReturn(dto);

            ResponseEntity<PortfolioDto> response = controller.getPortfolioById(1L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(portfolioService.getPortfolioById(1L)).thenThrow(new RuntimeException());

            ResponseEntity<PortfolioDto> response = controller.getPortfolioById(1L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getPortfoliosByManager")
    class ByManager {
        @Test
        void whenAdminAccessesAnyManager_thenReturnsOk() {
            when(portfolioService.getPortfoliosByManager(5L)).thenReturn(List.of());

            ResponseEntity<List<PortfolioDto>> response = controller.getPortfoliosByManager("5", createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenManagerAccessesOwnPortfolios_thenReturnsOk() {
            User user = new User();
            user.setId(5L);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));
            when(portfolioService.getPortfoliosByManager(5L)).thenReturn(List.of());

            ResponseEntity<List<PortfolioDto>> response = controller.getPortfoliosByManager("5", createJwt("SUPER_MANAGER"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenManagerAccessesOtherPortfolios_thenReturns403() {
            User user = new User();
            user.setId(99L); // Different from requested manager ID
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));

            ResponseEntity<List<PortfolioDto>> response = controller.getPortfoliosByManager("5", createJwt("SUPER_MANAGER"));
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        void whenKeycloakId_thenResolvesFromDb() {
            User user = new User();
            user.setId(5L);
            when(userRepository.findByKeycloakId("kc-uuid")).thenReturn(Optional.of(user));
            when(portfolioService.getPortfoliosByManager(5L)).thenReturn(List.of());

            ResponseEntity<List<PortfolioDto>> response = controller.getPortfoliosByManager("kc-uuid", createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("stats")
    class Stats {
        @Test
        void whenGetStats_thenReturnsOk() {
            PortfolioStatsDto stats = new PortfolioStatsDto();
            when(portfolioService.getStatsByManager(5L)).thenReturn(stats);

            ResponseEntity<PortfolioStatsDto> response = controller.getStatsByManager("5", createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getAllActivePortfolios")
    class AllActive {
        @Test
        void whenSuccess_thenReturnsOk() {
            when(portfolioService.getAllActivePortfolios()).thenReturn(List.of());
            ResponseEntity<List<PortfolioDto>> response = controller.getAllActivePortfolios();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("clients")
    class Clients {
        @Test
        void whenAddClient_thenReturnsOk() {
            PortfolioClientDto dto = new PortfolioClientDto();
            when(portfolioService.addClientToPortfolio(1L, 5L, "notes")).thenReturn(dto);

            ResponseEntity<PortfolioClientDto> response = controller.addClientToPortfolio(1L, 5L, "notes", createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenRemoveClient_thenReturnsOk() {
            ResponseEntity<Void> response = controller.removeClientFromPortfolio(1L, 5L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(portfolioService).removeClientFromPortfolio(1L, 5L);
        }

        @Test
        void whenGetClients_thenReturnsOk() {
            when(portfolioService.getPortfolioClients(1L)).thenReturn(List.of());
            ResponseEntity<List<PortfolioClientDto>> response = controller.getPortfolioClients(1L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("teamMembers")
    class TeamMembers {
        @Test
        void whenAddTeamMember_thenReturnsOk() {
            PortfolioTeamDto dto = new PortfolioTeamDto();
            when(portfolioService.addTeamMemberToPortfolio(1L, 5L, TeamRole.HOUSEKEEPER, "notes")).thenReturn(dto);

            ResponseEntity<PortfolioTeamDto> response = controller.addTeamMemberToPortfolio(1L, 5L, TeamRole.HOUSEKEEPER, "notes", createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenRemoveTeamMember_thenReturnsOk() {
            ResponseEntity<Void> response = controller.removeTeamMemberFromPortfolio(1L, 5L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(portfolioService).removeTeamMemberFromPortfolio(1L, 5L);
        }

        @Test
        void whenGetTeamMembers_thenReturnsOk() {
            when(portfolioService.getPortfolioTeamMembers(1L)).thenReturn(List.of());
            ResponseEntity<List<PortfolioTeamDto>> response = controller.getPortfolioTeamMembers(1L, createJwt("SUPER_ADMIN"));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("findManager")
    class FindManager {
        @Test
        void whenFindManagerForHost_thenReturnsId() {
            ResponseEntity<Long> response = controller.findManagerForHost(1L);
            assertThat(response.getBody()).isEqualTo(1L);
        }

        @Test
        void whenFindManagerForTeamMember_thenReturnsId() {
            ResponseEntity<Long> response = controller.findManagerForTeamMember(1L);
            assertThat(response.getBody()).isEqualTo(1L);
        }
    }
}
