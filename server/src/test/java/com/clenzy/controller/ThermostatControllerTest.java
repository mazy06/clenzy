package com.clenzy.controller;

import com.clenzy.dto.thermostat.CreateThermostatDto;
import com.clenzy.dto.thermostat.ThermostatDto;
import com.clenzy.service.ThermostatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ThermostatController")
class ThermostatControllerTest {

    @Mock private ThermostatService thermostatService;

    private ThermostatController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ThermostatController(thermostatService);
        jwt = Jwt.withTokenValue("t").header("alg", "RS256").claim("sub", "kc-user-1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private ThermostatDto dto() {
        return new ThermostatDto(1L, "Salon", 10L, "Villa", "RDC", "TUYA", "ACTIVE",
                true, 21.5, 22.0, 46, "heat", "Confort", LocalDateTime.now());
    }

    @Test
    @DisplayName("GET — liste")
    void list() {
        when(thermostatService.getUserThermostats("kc-user-1")).thenReturn(List.of(dto()));
        ResponseEntity<List<ThermostatDto>> resp = controller.getThermostats(jwt);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
    }

    @Test
    @DisplayName("POST — creation 200")
    void create() {
        CreateThermostatDto req = new CreateThermostatDto("Salon", 10L, "RDC", "TUYA", "tuya-1");
        when(thermostatService.createThermostat("kc-user-1", req)).thenReturn(dto());
        assertThat(controller.createThermostat(jwt, req).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("GET /status — rafraichit via Tuya")
    void status() {
        when(thermostatService.refreshStatus("kc-user-1", 1L)).thenReturn(dto());
        assertThat(controller.getStatus(jwt, 1L).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("POST /target — definit la consigne")
    void setTarget() {
        when(thermostatService.setTargetTemp("kc-user-1", 1L, 22.0)).thenReturn(dto());
        assertThat(controller.setTarget(jwt, 1L, 22.0).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(thermostatService).setTargetTemp("kc-user-1", 1L, 22.0);
    }

    @Test
    @DisplayName("DELETE — 200")
    void delete() {
        assertThat(controller.deleteThermostat(jwt, 5L).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(thermostatService).deleteThermostat("kc-user-1", 5L);
    }
}
