package com.clenzy.integration.tuya.controller;

import com.clenzy.dto.noise.TuyaConnectionStatusDto;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.NoiseDevice;
import com.clenzy.repository.NoiseDeviceRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TuyaControllerTest {

    @Mock private TuyaApiService apiService;
    @Mock private NoiseDeviceRepository noiseDeviceRepository;

    private TuyaController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new TuyaController(apiService, noiseDeviceRepository);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    // ── connect ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("connect")
    class Connect {

        @Test
        @DisplayName("when successful then returns connected with tuya uid")
        void whenSuccessful_thenReturnsConnected() {
            // Arrange
            TuyaConnection connection = new TuyaConnection();
            connection.setTuyaUid("tuya-uid-456");
            when(apiService.createConnection("user-123")).thenReturn(connection);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "connected")
                    .containsEntry("tuya_uid", "tuya-uid-456");
        }

        @Test
        @DisplayName("when configuration missing then returns bad request")
        void whenConfigMissing_thenReturnsBadRequest() {
            // Arrange
            when(apiService.createConnection("user-123"))
                    .thenThrow(new IllegalStateException("Access ID not configured"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody())
                    .containsEntry("error", "configuration_missing")
                    .containsEntry("message", "Access ID not configured");
        }

        @Test
        @DisplayName("when connection fails then returns internal server error")
        void whenConnectionFails_thenReturnsError() {
            // Arrange
            when(apiService.createConnection("user-123"))
                    .thenThrow(new RuntimeException("Connection refused"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).containsEntry("status", "error");
        }
    }

    // ── disconnect ──────────────────────────────────────────────────

    @Nested
    @DisplayName("disconnect")
    class Disconnect {

        @Test
        @DisplayName("when successful then returns disconnected")
        void whenSuccessful_thenReturnsDisconnected() {
            // Arrange
            doNothing().when(apiService).disconnect("user-123");

            // Act
            ResponseEntity<Map<String, String>> response = controller.disconnect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "disconnected");
        }

        @Test
        @DisplayName("when disconnect fails then returns error")
        void whenDisconnectFails_thenReturnsError() {
            // Arrange
            doThrow(new RuntimeException("Disconnect failed")).when(apiService).disconnect("user-123");

            // Act
            ResponseEntity<Map<String, String>> response = controller.disconnect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).containsEntry("status", "error");
        }
    }

    // ── status ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("status")
    class Status {

        @Test
        @DisplayName("when connected then returns full status with device count")
        void whenConnected_thenReturnsFullStatus() {
            // Arrange
            TuyaConnection connection = new TuyaConnection();
            connection.setStatus(TuyaConnection.TuyaConnectionStatus.ACTIVE);
            connection.setTuyaUid("tuya-uid-456");
            connection.setConnectedAt(LocalDateTime.of(2026, 1, 5, 9, 0));
            connection.setLastSyncAt(LocalDateTime.of(2026, 2, 21, 12, 0));

            when(apiService.getConnectionStatus("user-123")).thenReturn(Optional.of(connection));
            when(noiseDeviceRepository.countByUserId("user-123")).thenReturn(5L);

            // Act
            ResponseEntity<TuyaConnectionStatusDto> response = controller.status(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            TuyaConnectionStatusDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getStatus()).isEqualTo("ACTIVE");
            assertThat(dto.getTuyaUid()).isEqualTo("tuya-uid-456");
            assertThat(dto.getDeviceCount()).isEqualTo(5);
        }

        @Test
        @DisplayName("when not connected then returns not connected status")
        void whenNotConnected_thenReturnsNotConnected() {
            // Arrange
            when(apiService.getConnectionStatus("user-123")).thenReturn(Optional.empty());

            // Act
            ResponseEntity<TuyaConnectionStatusDto> response = controller.status(jwt);

            // Assert
            TuyaConnectionStatusDto dto = response.getBody();
            assertThat(dto.isConnected()).isFalse();
            assertThat(dto.getStatus()).isEqualTo("NOT_CONNECTED");
            assertThat(dto.getDeviceCount()).isZero();
        }

        @Test
        @DisplayName("when connection status is ERROR then connected is false")
        void whenConnectionError_thenConnectedIsFalse() {
            // Arrange
            TuyaConnection connection = new TuyaConnection();
            connection.setStatus(TuyaConnection.TuyaConnectionStatus.ERROR);
            connection.setErrorMessage("Token expired");

            when(apiService.getConnectionStatus("user-123")).thenReturn(Optional.of(connection));
            when(noiseDeviceRepository.countByUserId("user-123")).thenReturn(0L);

            // Act
            ResponseEntity<TuyaConnectionStatusDto> response = controller.status(jwt);

            // Assert
            TuyaConnectionStatusDto dto = response.getBody();
            assertThat(dto.isConnected()).isFalse();
            assertThat(dto.getStatus()).isEqualTo("ERROR");
            assertThat(dto.getErrorMessage()).isEqualTo("Token expired");
        }
    }

    // ── getDeviceInfo ───────────────────────────────────────────────

    @Nested
    @DisplayName("getDeviceInfo")
    class GetDeviceInfo {

        @Test
        @DisplayName("when user owns device then returns device info")
        @SuppressWarnings("unchecked")
        void whenUserOwnsDevice_thenReturnsDeviceInfo() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("tuya-device-1");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDeviceInfo("tuya-device-1"))
                    .thenReturn(Map.of("id", "tuya-device-1", "name", "Noise Sensor"));

            // Act
            ResponseEntity<?> response = controller.getDeviceInfo(jwt, "tuya-device-1");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("id", "tuya-device-1");
        }

        @Test
        @DisplayName("when user does not own device then returns 403")
        @SuppressWarnings("unchecked")
        void whenUserDoesNotOwnDevice_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getDeviceInfo(jwt, "tuya-device-999");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "access_denied");
        }

        @Test
        @DisplayName("when API fails then returns error")
        void whenApiFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("tuya-device-1");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDeviceInfo("tuya-device-1"))
                    .thenThrow(new RuntimeException("Tuya API unreachable"));

            // Act
            ResponseEntity<?> response = controller.getDeviceInfo(jwt, "tuya-device-1");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ── getDeviceStatus ─────────────────────────────────────────────

    @Nested
    @DisplayName("getDeviceStatus")
    class GetDeviceStatus {

        @Test
        @DisplayName("when user owns device then returns device status")
        void whenUserOwnsDevice_thenReturnsDeviceStatus() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("tuya-device-1");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDeviceStatus("tuya-device-1"))
                    .thenReturn(Map.of("noise_value", 42));

            // Act
            ResponseEntity<?> response = controller.getDeviceStatus(jwt, "tuya-device-1");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own device then returns 403")
        void whenUserDoesNotOwnDevice_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getDeviceStatus(jwt, "other-device");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }
    }

    // ── getDeviceLogs ───────────────────────────────────────────────

    @Nested
    @DisplayName("getDeviceLogs")
    class GetDeviceLogs {

        @Test
        @DisplayName("when user owns device then returns logs")
        void whenUserOwnsDevice_thenReturnsLogs() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("tuya-device-1");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDeviceLogs("tuya-device-1", 1000L, 2000L))
                    .thenReturn(Map.of("logs", List.of()));

            // Act
            ResponseEntity<?> response = controller.getDeviceLogs(jwt, "tuya-device-1", 1000L, 2000L);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own device then returns 403")
        void whenUserDoesNotOwnDevice_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getDeviceLogs(jwt, "other-device", 1000L, 2000L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        @DisplayName("when API fails then returns error")
        void whenApiFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("tuya-device-1");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDeviceLogs("tuya-device-1", 1000L, 2000L))
                    .thenThrow(new RuntimeException("Timeout"));

            // Act
            ResponseEntity<?> response = controller.getDeviceLogs(jwt, "tuya-device-1", 1000L, 2000L);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
