package com.clenzy.controller;

import com.clenzy.dto.device.DeviceSummaryDto;
import com.clenzy.dto.device.ProviderStatusDto;
import com.clenzy.service.DeviceAggregationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DeviceController")
class DeviceControllerTest {

    @Mock private DeviceAggregationService deviceAggregationService;

    private DeviceController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new DeviceController(deviceAggregationService);
        jwt = Jwt.withTokenValue("t").header("alg", "RS256").claim("sub", "kc-user-1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    @Test
    @DisplayName("GET /api/devices — read-model unifie")
    void getDevices() {
        DeviceSummaryDto d = new DeviceSummaryDto("lock", 1L, "Serrure", 10L, "Villa", "Entree",
                "NUKI", "ACTIVE", "LOCKED", 80, null, LocalDateTime.now());
        when(deviceAggregationService.getDevices("kc-user-1")).thenReturn(List.of(d));
        assertThat(controller.getDevices(jwt).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(controller.getDevices(jwt).getBody()).hasSize(1);
    }

    @Test
    @DisplayName("GET /api/devices/providers — statut providers")
    void getProviders() {
        ProviderStatusDto p = new ProviderStatusDto("NUKI", true, 2L, "ACTIVE");
        when(deviceAggregationService.getProviderStatuses("kc-user-1")).thenReturn(List.of(p));
        assertThat(controller.getProviders(jwt).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(controller.getProviders(jwt).getBody()).containsExactly(p);
    }
}
