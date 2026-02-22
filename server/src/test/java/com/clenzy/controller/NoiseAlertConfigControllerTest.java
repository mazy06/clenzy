package com.clenzy.controller;

import com.clenzy.dto.noise.NoiseAlertConfigDto;
import com.clenzy.dto.noise.SaveNoiseAlertConfigDto;
import com.clenzy.service.NoiseAlertConfigService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertConfigControllerTest {

    @Mock private NoiseAlertConfigService configService;
    @Mock private TenantContext tenantContext;

    private NoiseAlertConfigController controller;

    @BeforeEach
    void setUp() {
        controller = new NoiseAlertConfigController(configService, tenantContext);
    }

    @Nested
    @DisplayName("getAll")
    class GetAll {
        @Test
        void whenCalled_thenReturnsConfigs() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            NoiseAlertConfigDto dto = mock(NoiseAlertConfigDto.class);
            when(configService.getAllForOrg(1L)).thenReturn(List.of(dto));

            ResponseEntity<List<NoiseAlertConfigDto>> response = controller.getAll();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenFound_thenReturnsOk() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            NoiseAlertConfigDto dto = mock(NoiseAlertConfigDto.class);
            when(configService.getByProperty(1L, 5L)).thenReturn(dto);

            ResponseEntity<NoiseAlertConfigDto> response = controller.getByProperty(5L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(configService.getByProperty(1L, 5L)).thenReturn(null);

            ResponseEntity<NoiseAlertConfigDto> response = controller.getByProperty(5L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("save")
    class Save {
        @Test
        void whenValid_thenReturnsOk() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            SaveNoiseAlertConfigDto dto = mock(SaveNoiseAlertConfigDto.class);
            NoiseAlertConfigDto saved = mock(NoiseAlertConfigDto.class);
            when(configService.save(1L, 5L, dto)).thenReturn(saved);

            ResponseEntity<?> response = controller.save(5L, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInvalidArg_thenBadRequest() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            SaveNoiseAlertConfigDto dto = mock(SaveNoiseAlertConfigDto.class);
            when(configService.save(1L, 5L, dto)).thenThrow(new IllegalArgumentException("Invalid threshold"));

            ResponseEntity<?> response = controller.save(5L, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenCalled_thenReturnsNoContent() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            ResponseEntity<Void> response = controller.delete(5L);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(configService).delete(1L, 5L);
        }
    }
}
