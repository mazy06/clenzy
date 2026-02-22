package com.clenzy.controller;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertControllerTest {

    @Mock private NoiseAlertService alertService;
    @Mock private TenantContext tenantContext;

    private NoiseAlertController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new NoiseAlertController(alertService, tenantContext);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("getAlerts")
    class GetAlerts {
        @Test
        void whenNoFilters_thenReturnsPaginated() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            NoiseAlertDto dto = mock(NoiseAlertDto.class);
            Page<NoiseAlertDto> page = new PageImpl<>(List.of(dto));
            when(alertService.getAlerts(eq(1L), isNull(), isNull(), any(PageRequest.class))).thenReturn(page);

            ResponseEntity<Page<NoiseAlertDto>> response = controller.getAlerts(null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }

        @Test
        void whenWithFilters_thenPassesFilters() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Page<NoiseAlertDto> page = new PageImpl<>(List.of());
            when(alertService.getAlerts(eq(1L), eq(5L), eq("HIGH"), any(PageRequest.class))).thenReturn(page);

            ResponseEntity<Page<NoiseAlertDto>> response = controller.getAlerts(5L, "HIGH", 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSizeExceeds100_thenCapsAt100() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Page<NoiseAlertDto> page = new PageImpl<>(List.of());
            when(alertService.getAlerts(eq(1L), isNull(), isNull(), any(PageRequest.class))).thenReturn(page);

            controller.getAlerts(null, null, 0, 500);

            verify(alertService).getAlerts(eq(1L), isNull(), isNull(), eq(PageRequest.of(0, 100)));
        }
    }

    @Nested
    @DisplayName("getUnacknowledgedCount")
    class GetUnacknowledgedCount {
        @Test
        void whenCalled_thenReturnsCount() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(alertService.getUnacknowledgedCount(1L)).thenReturn(5L);

            ResponseEntity<Map<String, Long>> response = controller.getUnacknowledgedCount();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("count", 5L);
        }
    }

    @Nested
    @DisplayName("acknowledge")
    class Acknowledge {
        @Test
        void whenFound_thenReturnsOk() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            NoiseAlertDto dto = mock(NoiseAlertDto.class);
            when(alertService.acknowledge(10L, 1L, "user-123", "Handled")).thenReturn(dto);

            ResponseEntity<?> response = controller.acknowledge(10L, jwt, Map.of("notes", "Handled"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(alertService.acknowledge(10L, 1L, "user-123", null))
                    .thenThrow(new IllegalArgumentException("Not found"));

            ResponseEntity<?> response = controller.acknowledge(10L, jwt, null);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }
}
