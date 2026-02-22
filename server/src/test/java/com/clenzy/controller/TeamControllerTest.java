package com.clenzy.controller;

import com.clenzy.dto.TeamDto;
import com.clenzy.service.TeamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamControllerTest {

    @Mock private TeamService teamService;

    private TeamController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new TeamController(teamService);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenValidJwt_thenCreatesTeam() {
            TeamDto dto = new TeamDto();
            dto.name = "Equipe A";
            TeamDto created = new TeamDto();
            created.id = 1L;
            created.name = "Equipe A";

            when(teamService.create(any(TeamDto.class), any(Jwt.class))).thenReturn(created);

            ResponseEntity<TeamDto> response = controller.create(dto, createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().name).isEqualTo("Equipe A");
        }

        @Test
        void whenNullJwt_thenReturns401() {
            ResponseEntity<TeamDto> response = controller.create(new TeamDto(), null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    @Test
    @DisplayName("update delegates to service")
    void whenUpdate_thenDelegates() {
        TeamDto dto = new TeamDto();
        dto.name = "Updated";
        TeamDto updated = new TeamDto();
        updated.id = 1L;
        updated.name = "Updated";

        when(teamService.update(1L, dto)).thenReturn(updated);

        TeamDto result = controller.update(1L, dto);
        assertThat(result.name).isEqualTo("Updated");
    }

    @Test
    @DisplayName("get delegates to service")
    void whenGet_thenDelegates() {
        TeamDto dto = new TeamDto();
        dto.id = 1L;
        when(teamService.getById(1L)).thenReturn(dto);

        TeamDto result = controller.get(1L);
        assertThat(result.id).isEqualTo(1L);
    }

    @Test
    @DisplayName("list with valid JWT delegates to service")
    void whenList_thenDelegates() {
        Jwt jwt = createJwt();
        var pageable = PageRequest.of(0, 10);
        Page<TeamDto> page = new PageImpl<>(List.of(new TeamDto()));
        when(teamService.list(any(), eq(jwt))).thenReturn(page);

        Page<TeamDto> result = controller.list(pageable, jwt);
        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("list with null JWT throws")
    void whenListWithNullJwt_thenThrows() {
        assertThatThrownBy(() -> controller.list(PageRequest.of(0, 10), null))
                .isInstanceOf(RuntimeException.class);
    }
}
