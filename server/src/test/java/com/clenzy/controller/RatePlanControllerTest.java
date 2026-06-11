package com.clenzy.controller;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.service.RatePlanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de RatePlanController.
 *
 * NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus aucun
 * repository. La logique deplacee (validation d'acces propriete, defaults,
 * patch partiel) est testee dans com.clenzy.service.RatePlanServiceTest ;
 * la regle d'acces elle-meme dans ReservationServiceTest
 * (validatePropertyAccess).
 */
@ExtendWith(MockitoExtension.class)
class RatePlanControllerTest {

    @Mock private RatePlanService ratePlanService;

    private RatePlanController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new RatePlanController(ratePlanService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private RatePlanDto sampleDto(Long id) {
        return new RatePlanDto(id, 1L, "Summer", "SEASONAL", 1, 150.0, "EUR",
                "2026-06-01", "2026-09-01", null, null, true);
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenOwner_thenReturnsPlans() {
            when(ratePlanService.getByProperty(1L, "user-123")).thenReturn(List.of(sampleDto(10L)));

            ResponseEntity<List<RatePlanDto>> response = controller.getByProperty(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(ratePlanService.getByProperty(99L, "user-123"))
                    .thenThrow(new NotFoundException("Propriete introuvable: 99"));

            assertThatThrownBy(() -> controller.getByProperty(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenSuperAdmin_thenCreates() {
            RatePlanDto dto = sampleDto(null);
            when(ratePlanService.create(dto, "user-123")).thenReturn(sampleDto(10L));

            ResponseEntity<RatePlanDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenOwner_thenUpdates() {
            RatePlanDto dto = new RatePlanDto(null, 1L, "Updated", null, null, 200.0, null,
                    null, null, null, null, null);
            when(ratePlanService.update(10L, dto, "user-123")).thenReturn(sampleDto(10L));

            ResponseEntity<RatePlanDto> response = controller.update(10L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenPlanNotFound_thenThrows() {
            RatePlanDto dto = new RatePlanDto(null, 1L, "Test", null, null, null, null,
                    null, null, null, null, null);
            when(ratePlanService.update(99L, dto, "user-123"))
                    .thenThrow(new NotFoundException("Plan tarifaire non trouve: 99"));

            assertThatThrownBy(() -> controller.update(99L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenOwner_thenDeletes() {
            ResponseEntity<Void> response = controller.delete(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(ratePlanService).delete(10L, "user-123");
        }

        @Test
        void whenNotOwner_thenThrowsAccessDenied() {
            doThrow(new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete"))
                    .when(ratePlanService).delete(10L, "user-123");

            assertThatThrownBy(() -> controller.delete(10L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
