package com.clenzy.controller;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.service.RateOverrideService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de RateOverrideController.
 *
 * NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus aucun
 * repository. La logique deplacee (validation d'acces propriete, defaults
 * source/devise, bulk) est testee dans
 * com.clenzy.service.RateOverrideServiceTest ; la regle d'acces elle-meme
 * dans ReservationServiceTest (validatePropertyAccess).
 */
@ExtendWith(MockitoExtension.class)
class RateOverrideControllerTest {

    @Mock private RateOverrideService rateOverrideService;

    private RateOverrideController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new RateOverrideController(rateOverrideService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByRange {
        @Test
        void whenOwner_thenReturnsList() {
            RateOverrideDto dto = new RateOverrideDto(1L, 1L, "2026-03-01", 120.0, "MANUAL", "EUR");
            when(rateOverrideService.getByPropertyAndRange(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 31), "user-123")).thenReturn(List.of(dto));

            ResponseEntity<List<RateOverrideDto>> response = controller.getByPropertyAndRange(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenAccessDenied_thenThrows() {
            when(rateOverrideService.getByPropertyAndRange(eq(1L), any(), any(), eq("user-123")))
                    .thenThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"));

            assertThatThrownBy(() -> controller.getByPropertyAndRange(
                    1L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenSuperAdmin_thenCreates() {
            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, null, null);
            when(rateOverrideService.create(dto, "user-123"))
                    .thenReturn(new RateOverrideDto(10L, 1L, "2026-03-15", 150.0, "MANUAL", "EUR"));

            ResponseEntity<RateOverrideDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        void whenSuperAdmin_thenCreatesMultiple() {
            Map<String, Object> body = Map.of(
                    "propertyId", 1L,
                    "from", "2026-03-01",
                    "to", "2026-03-04",
                    "nightlyPrice", 120
            );
            when(rateOverrideService.createBulk(body, "user-123"))
                    .thenReturn(Map.of(
                            "propertyId", 1L,
                            "from", "2026-03-01",
                            "to", "2026-03-04",
                            "nightlyPrice", 120.0,
                            "count", 3));

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("count", 3);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenOwner_thenDeletes() {
            ResponseEntity<Void> response = controller.delete(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(rateOverrideService).delete(10L, "user-123");
        }

        @Test
        void whenNotFound_thenThrows() {
            doThrow(new NotFoundException("Override non trouve: 99"))
                    .when(rateOverrideService).delete(99L, "user-123");

            assertThatThrownBy(() -> controller.delete(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }
}
