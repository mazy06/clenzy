package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.dto.AirbnbConnectionStatusDto;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AirbnbOAuthControllerTest {

    @Mock private AirbnbOAuthService oAuthService;
    @Mock private AirbnbListingMappingRepository listingMappingRepository;

    private AirbnbOAuthController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new AirbnbOAuthController(oAuthService, listingMappingRepository);
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
        @DisplayName("when already connected then returns already_connected status")
        void whenAlreadyConnected_thenReturnsAlreadyConnectedStatus() {
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
        void whenNotConnected_thenReturnsAuthorizationUrl() {
            // Arrange
            when(oAuthService.isConnected("user-123")).thenReturn(false);
            when(oAuthService.getAuthorizationUrl("user-123"))
                    .thenReturn("https://airbnb.com/oauth2/auth?state=abc123");

            // Act
            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "redirect")
                    .containsEntry("authorization_url", "https://airbnb.com/oauth2/auth?state=abc123");
        }

        @Test
        @DisplayName("when config missing then returns bad request")
        void whenConfigMissing_thenReturnsBadRequest() {
            // Arrange
            when(oAuthService.isConnected("user-123")).thenReturn(false);
            when(oAuthService.getAuthorizationUrl("user-123"))
                    .thenThrow(new IllegalStateException("Client ID not configured"));

            // Act
            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody())
                    .containsEntry("error", "configuration_missing")
                    .containsEntry("message", "Client ID not configured");
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
            AirbnbConnection connection = new AirbnbConnection();
            connection.setAirbnbUserId("airbnb-456");
            when(oAuthService.validateAndConsumeState("state-abc")).thenReturn("user-123");
            when(oAuthService.exchangeCodeForToken("code-xyz", "user-123")).thenReturn(connection);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.callback("code-xyz", "state-abc");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "connected")
                    .containsEntry("airbnb_user_id", "airbnb-456");
        }

        @Test
        @DisplayName("when invalid state then returns internal server error")
        void whenInvalidState_thenReturnsError() {
            // Arrange
            when(oAuthService.validateAndConsumeState("bad-state"))
                    .thenThrow(new RuntimeException("Invalid or expired state"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.callback("code", "bad-state");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).containsEntry("status", "error");
        }

        @Test
        @DisplayName("when token exchange fails then returns error")
        void whenTokenExchangeFails_thenReturnsError() {
            // Arrange
            when(oAuthService.validateAndConsumeState("state")).thenReturn("user-123");
            when(oAuthService.exchangeCodeForToken("bad-code", "user-123"))
                    .thenThrow(new RuntimeException("Token exchange failed"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.callback("bad-code", "state");

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody())
                    .containsEntry("status", "error")
                    .containsEntry("message", "Echec de la connexion Airbnb");
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
            verify(oAuthService).revokeToken("user-123");
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
        @DisplayName("when connected then returns full status with linked listings count")
        void whenConnected_thenReturnsFullStatusWithListingsCount() {
            // Arrange
            AirbnbConnection connection = new AirbnbConnection();
            connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            connection.setAirbnbUserId("airbnb-456");
            connection.setConnectedAt(LocalDateTime.of(2026, 1, 15, 10, 0));
            connection.setLastSyncAt(LocalDateTime.of(2026, 2, 20, 14, 30));
            connection.setScopes("listings_r,reservations_r");
            connection.setErrorMessage(null);

            when(oAuthService.getConnectionStatus("user-123")).thenReturn(Optional.of(connection));

            AirbnbListingMapping mapping1 = new AirbnbListingMapping();
            AirbnbListingMapping mapping2 = new AirbnbListingMapping();
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of(mapping1, mapping2));

            // Act
            ResponseEntity<AirbnbConnectionStatusDto> response = controller.status(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            AirbnbConnectionStatusDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getAirbnbUserId()).isEqualTo("airbnb-456");
            assertThat(dto.getStatus()).isEqualTo("ACTIVE");
            assertThat(dto.getLinkedListingsCount()).isEqualTo(2);
            assertThat(dto.getScopes()).isEqualTo("listings_r,reservations_r");
            assertThat(dto.getConnectedAt()).isEqualTo(LocalDateTime.of(2026, 1, 15, 10, 0));
            assertThat(dto.getLastSyncAt()).isEqualTo(LocalDateTime.of(2026, 2, 20, 14, 30));
        }

        @Test
        @DisplayName("when not connected then returns not connected status")
        void whenNotConnected_thenReturnsNotConnectedStatus() {
            // Arrange
            when(oAuthService.getConnectionStatus("user-123")).thenReturn(Optional.empty());

            // Act
            ResponseEntity<AirbnbConnectionStatusDto> response = controller.status(jwt);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            AirbnbConnectionStatusDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.isConnected()).isFalse();
            assertThat(dto.getStatus()).isEqualTo("NOT_CONNECTED");
            assertThat(dto.getLinkedListingsCount()).isZero();
        }

        @Test
        @DisplayName("when connection status is REVOKED then connected is false")
        void whenConnectionRevoked_thenConnectedIsFalse() {
            // Arrange
            AirbnbConnection connection = new AirbnbConnection();
            connection.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            connection.setAirbnbUserId("airbnb-456");

            when(oAuthService.getConnectionStatus("user-123")).thenReturn(Optional.of(connection));
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of());

            // Act
            ResponseEntity<AirbnbConnectionStatusDto> response = controller.status(jwt);

            // Assert
            AirbnbConnectionStatusDto dto = response.getBody();
            assertThat(dto.isConnected()).isFalse();
            assertThat(dto.getStatus()).isEqualTo("REVOKED");
            assertThat(dto.getLinkedListingsCount()).isZero();
        }
    }
}
