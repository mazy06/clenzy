package com.clenzy.integration.minut.controller;

import com.clenzy.dto.noise.MinutConnectionStatusDto;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.minut.service.MinutOAuthService;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MinutControllerTest {

    @Mock private MinutOAuthService oAuthService;
    @Mock private MinutApiService apiService;
    @Mock private NoiseDeviceRepository noiseDeviceRepository;

    private MinutController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new MinutController(oAuthService, apiService, noiseDeviceRepository);
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
        @DisplayName("when already connected then returns already_connected")
        void whenAlreadyConnected_thenReturnsAlreadyConnected() {
            // Arrange
            when(oAuthService.isConnected("user-123")).thenReturn(true);

            // Act
            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "already_connected");
            verify(oAuthService, never()).getAuthorizationUrl(anyString());
        }

        @Test
        @DisplayName("when not connected then returns authorization URL")
        void whenNotConnected_thenReturnsAuthUrl() {
            // Arrange
            when(oAuthService.isConnected("user-123")).thenReturn(false);
            when(oAuthService.getAuthorizationUrl("user-123"))
                    .thenReturn("https://api.minut.com/v8/oauth/authorize?state=xyz");

            // Act
            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "redirect")
                    .containsEntry("authorization_url", "https://api.minut.com/v8/oauth/authorize?state=xyz");
        }

        @Test
        @DisplayName("when configuration missing then returns bad request")
        void whenConfigMissing_thenReturnsBadRequest() {
            // Arrange
            when(oAuthService.isConnected("user-123")).thenReturn(false);
            when(oAuthService.getAuthorizationUrl("user-123"))
                    .thenThrow(new IllegalStateException("Minut client ID not configured"));

            // Act
            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("error", "configuration_missing");
        }
    }

    // ── callback ────────────────────────────────────────────────────

    @Nested
    @DisplayName("callback")
    class Callback {

        @Test
        @DisplayName("when valid code and state then returns connected")
        void whenValidCodeAndState_thenReturnsConnected() {
            // Arrange
            MinutConnection connection = new MinutConnection();
            connection.setMinutUserId("minut-user-789");
            when(oAuthService.validateAndConsumeState("state-abc")).thenReturn("user-123");
            when(oAuthService.exchangeCodeForToken("code-xyz", "user-123")).thenReturn(connection);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.callback("code-xyz", "state-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "connected")
                    .containsEntry("minut_user_id", "minut-user-789");
        }

        @Test
        @DisplayName("when state validation fails then returns error")
        void whenStateValidationFails_thenReturnsError() {
            // Arrange
            when(oAuthService.validateAndConsumeState("bad-state"))
                    .thenThrow(new RuntimeException("Invalid state"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.callback("code", "bad-state");

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
            doNothing().when(oAuthService).revokeToken("user-123");

            // Act
            ResponseEntity<Map<String, String>> response = controller.disconnect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "disconnected");
        }

        @Test
        @DisplayName("when revoke fails then returns error")
        void whenRevokeFails_thenReturnsError() {
            // Arrange
            doThrow(new RuntimeException("Revoke failed")).when(oAuthService).revokeToken("user-123");

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
            MinutConnection connection = new MinutConnection();
            connection.setStatus(MinutConnection.MinutConnectionStatus.ACTIVE);
            connection.setMinutUserId("minut-user-789");
            connection.setMinutOrganizationId("org-456");
            connection.setConnectedAt(LocalDateTime.of(2026, 1, 10, 8, 0));
            connection.setLastSyncAt(LocalDateTime.of(2026, 2, 20, 15, 0));

            when(oAuthService.getConnectionStatus("user-123")).thenReturn(Optional.of(connection));
            when(noiseDeviceRepository.countByUserId("user-123")).thenReturn(3L);

            // Act
            ResponseEntity<MinutConnectionStatusDto> response = controller.status(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            MinutConnectionStatusDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getStatus()).isEqualTo("ACTIVE");
            assertThat(dto.getMinutUserId()).isEqualTo("minut-user-789");
            assertThat(dto.getMinutOrganizationId()).isEqualTo("org-456");
            assertThat(dto.getDeviceCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("when not connected then returns not connected status")
        void whenNotConnected_thenReturnsNotConnected() {
            // Arrange
            when(oAuthService.getConnectionStatus("user-123")).thenReturn(Optional.empty());

            // Act
            ResponseEntity<MinutConnectionStatusDto> response = controller.status(jwt);

            // Assert
            MinutConnectionStatusDto dto = response.getBody();
            assertThat(dto.isConnected()).isFalse();
            assertThat(dto.getStatus()).isEqualTo("NOT_CONNECTED");
            assertThat(dto.getDeviceCount()).isZero();
        }
    }

    // ── getDevice ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getDevice")
    class GetDevice {

        @Test
        @DisplayName("when user owns device then returns device info")
        @SuppressWarnings("unchecked")
        void whenUserOwnsDevice_thenReturnsDeviceInfo() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("device-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDevice("user-123", "device-abc"))
                    .thenReturn(Map.of("id", "device-abc", "name", "Living Room"));

            // Act
            ResponseEntity<?> response = controller.getDevice(jwt, "device-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("id", "device-abc");
        }

        @Test
        @DisplayName("when user does not own device then returns 403")
        @SuppressWarnings("unchecked")
        void whenUserDoesNotOwnDevice_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getDevice(jwt, "device-xyz");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "access_denied");
        }

        @Test
        @DisplayName("when API call fails then returns error")
        void whenApiCallFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalDeviceId("device-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDevice("user-123", "device-abc"))
                    .thenThrow(new RuntimeException("API timeout"));

            // Act
            ResponseEntity<?> response = controller.getDevice(jwt, "device-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ── getHome ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("getHome")
    class GetHome {

        @Test
        @DisplayName("when user owns home then returns home info")
        void whenUserOwnsHome_thenReturnsHomeInfo() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getHome("user-123", "home-abc"))
                    .thenReturn(Map.of("id", "home-abc", "name", "Beach House"));

            // Act
            ResponseEntity<?> response = controller.getHome(jwt, "home-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own home then returns 403")
        @SuppressWarnings("unchecked")
        void whenUserDoesNotOwnHome_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getHome(jwt, "home-xyz");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "access_denied");
        }

        @Test
        @DisplayName("when API call fails then returns error")
        void whenApiCallFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getHome("user-123", "home-abc"))
                    .thenThrow(new RuntimeException("API error"));

            // Act
            ResponseEntity<?> response = controller.getHome(jwt, "home-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ── getHomeEvents ───────────────────────────────────────────────

    @Nested
    @DisplayName("getHomeEvents")
    class GetHomeEvents {

        @Test
        @DisplayName("when user owns home then returns events")
        void whenUserOwnsHome_thenReturnsEvents() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getHomeEvents("user-123", "home-abc", "2026-01-01", "2026-02-01", "noise"))
                    .thenReturn(Map.of("events", List.of()));

            // Act
            ResponseEntity<?> response = controller.getHomeEvents(jwt, "home-abc", "2026-01-01", "2026-02-01", "noise");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own home then returns 403")
        void whenUserDoesNotOwnHome_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getHomeEvents(jwt, "home-xyz", null, null, null);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }
    }

    // ── getDisturbanceConfig ────────────────────────────────────────

    @Nested
    @DisplayName("getDisturbanceConfig")
    class GetDisturbanceConfig {

        @Test
        @DisplayName("when user owns home then returns config")
        void whenUserOwnsHome_thenReturnsConfig() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDisturbanceConfig("user-123", "home-abc"))
                    .thenReturn(Map.of("threshold", 70));

            // Act
            ResponseEntity<?> response = controller.getDisturbanceConfig(jwt, "home-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own home then returns 403")
        void whenUserDoesNotOwnHome_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.getDisturbanceConfig(jwt, "home-xyz");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        @DisplayName("when API fails then returns error")
        void whenApiFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.getDisturbanceConfig("user-123", "home-abc"))
                    .thenThrow(new RuntimeException("Connection timeout"));

            // Act
            ResponseEntity<?> response = controller.getDisturbanceConfig(jwt, "home-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ── updateDisturbanceConfig ─────────────────────────────────────

    @Nested
    @DisplayName("updateDisturbanceConfig")
    class UpdateDisturbanceConfig {

        @Test
        @DisplayName("when user owns home then updates config")
        void whenUserOwnsHome_thenUpdatesConfig() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            Map<String, Object> config = Map.of("threshold", 80);
            when(apiService.updateDisturbanceConfig("user-123", "home-abc", config))
                    .thenReturn(Map.of("threshold", 80, "updated", true));

            // Act
            ResponseEntity<?> response = controller.updateDisturbanceConfig(jwt, "home-abc", config);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when user does not own home then returns 403")
        void whenUserDoesNotOwnHome_thenReturns403() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of());

            // Act
            ResponseEntity<?> response = controller.updateDisturbanceConfig(jwt, "home-xyz", Map.of());

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        @DisplayName("when API fails then returns error")
        void whenApiFails_thenReturnsError() {
            // Arrange
            NoiseDevice device = new NoiseDevice();
            device.setExternalHomeId("home-abc");
            when(noiseDeviceRepository.findByUserId("user-123")).thenReturn(List.of(device));
            when(apiService.updateDisturbanceConfig(eq("user-123"), eq("home-abc"), any()))
                    .thenThrow(new RuntimeException("Server error"));

            // Act
            ResponseEntity<?> response = controller.updateDisturbanceConfig(jwt, "home-abc", Map.of("threshold", 80));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
