package com.clenzy.controller;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.service.MinNightsOverrideService;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de MinNightsOverrideController.
 *
 * NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus aucun
 * repository. La logique deplacee (validation d'acces propriete, upsert bulk,
 * validation minNights, defaults) est testee dans
 * com.clenzy.service.MinNightsOverrideServiceTest ; la regle d'acces
 * elle-meme dans ReservationServiceTest (validatePropertyAccess).
 */
@ExtendWith(MockitoExtension.class)
class MinNightsOverrideControllerTest {

    @Mock private MinNightsOverrideService minNightsOverrideService;

    private MinNightsOverrideController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new MinNightsOverrideController(minNightsOverrideService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "kc-user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByPropertyAndRange {
        @Test
        void returnsList() {
            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 31);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(1L, 100L, "2026-05-06", 3, "MANUAL");
            when(minNightsOverrideService.getByPropertyAndRange(100L, from, to, "kc-user-123"))
                    .thenReturn(List.of(dto));

            ResponseEntity<List<MinNightsOverrideDto>> response =
                    controller.getByPropertyAndRange(100L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).minNights()).isEqualTo(3);
        }

        @Test
        void propertyNotFound_throws() {
            when(minNightsOverrideService.getByPropertyAndRange(eq(100L), any(), any(), eq("kc-user-123")))
                    .thenThrow(new NotFoundException("Propriete introuvable: 100"));

            assertThatThrownBy(() ->
                    controller.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void propertyInOtherOrg_throwsAccessDenied() {
            when(minNightsOverrideService.getByPropertyAndRange(eq(100L), any(), any(), eq("kc-user-123")))
                    .thenThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"));

            assertThatThrownBy(() ->
                    controller.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void valid_returnsCreated() {
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 4, "MANUAL");
            when(minNightsOverrideService.create(dto, "kc-user-123"))
                    .thenReturn(new MinNightsOverrideDto(123L, 100L, "2026-06-15", 4, "MANUAL"));

            ResponseEntity<MinNightsOverrideDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().minNights()).isEqualTo(4);
        }

        @Test
        void invalidMinNights_throws() {
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 0, null);
            when(minNightsOverrideService.create(dto, "kc-user-123"))
                    .thenThrow(new IllegalArgumentException(
                            "minNights doit etre compris entre 1 et 365 (valeur recue: 0)"));

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("minNights doit etre");
        }
    }

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        void valid_returnsCount() {
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-04",
                    "minNights", 5
            );
            when(minNightsOverrideService.createBulk(body, "kc-user-123"))
                    .thenReturn(Map.of(
                            "propertyId", 100L,
                            "from", "2026-06-01",
                            "to", "2026-06-04",
                            "minNights", 5,
                            "count", 3));

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("count")).isEqualTo(3);
        }

        @Test
        void invalidMinNights_throws() {
            when(minNightsOverrideService.createBulk(anyMap(), eq("kc-user-123")))
                    .thenThrow(new IllegalArgumentException(
                            "minNights doit etre compris entre 1 et 365 (valeur recue: 0)"));

            assertThatThrownBy(() -> controller.createBulk(Map.of("minNights", 0), jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void valid_returns204() {
            ResponseEntity<Void> response = controller.delete(50L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(minNightsOverrideService).delete(50L, "kc-user-123");
        }

        @Test
        void notFound_throws() {
            doThrow(new NotFoundException("Override non trouve: 50"))
                    .when(minNightsOverrideService).delete(50L, "kc-user-123");

            assertThatThrownBy(() -> controller.delete(50L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void noAccess_throws() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(minNightsOverrideService).delete(50L, "kc-user-123");

            assertThatThrownBy(() -> controller.delete(50L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
