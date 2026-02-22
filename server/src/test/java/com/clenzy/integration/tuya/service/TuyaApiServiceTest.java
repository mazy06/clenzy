package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.config.TuyaConfig;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.model.TuyaConnection.TuyaConnectionStatus;
import com.clenzy.integration.tuya.repository.TuyaConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TuyaApiService}.
 * Covers token management, device operations, connection management,
 * and device ID validation (including path traversal prevention).
 */
@ExtendWith(MockitoExtension.class)
class TuyaApiServiceTest {

    @Mock private TuyaConfig config;
    @Mock private TuyaConnectionRepository connectionRepository;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private TenantContext tenantContext;
    @Mock private RestTemplate restTemplate;

    private TuyaApiService service;

    @BeforeEach
    void setUp() {
        service = new TuyaApiService(config, connectionRepository, encryptionService,
                tenantContext, restTemplate);
    }

    @SuppressWarnings("unchecked")
    private void stubTokenResponse() {
        // Set up cached token to avoid calling the real Tuya API
        ReflectionTestUtils.setField(service, "cachedAccessToken", "cached-token");
        ReflectionTestUtils.setField(service, "cachedTokenExpiry",
                LocalDateTime.now().plusHours(1));
    }

    // ===================================================================
    // getAccessToken
    // ===================================================================

    @Nested
    @DisplayName("getAccessToken")
    class GetAccessToken {

        @Test
        @DisplayName("returns cached token when still valid")
        void whenCachedTokenValid_thenReturnsCached() {
            // Arrange
            ReflectionTestUtils.setField(service, "cachedAccessToken", "cached-token");
            ReflectionTestUtils.setField(service, "cachedTokenExpiry",
                    LocalDateTime.now().plusHours(1));

            // Act
            String token = service.getAccessToken();

            // Assert
            assertThat(token).isEqualTo("cached-token");
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("throws when configuration is incomplete")
        void whenConfigNotConfigured_thenThrows() {
            // Arrange
            when(config.isConfigured()).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> service.getAccessToken())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Configuration Tuya incomplete");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("fetches new token from Tuya API when cache is empty")
        void whenNoCachedToken_thenFetchesFromApi() {
            // Arrange
            when(config.isConfigured()).thenReturn(true);
            when(config.getAccessId()).thenReturn("test-access-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of(
                    "access_token", "new-token",
                    "refresh_token", "new-refresh",
                    "expire_time", 7200
            );
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    eq(Map.class))).thenReturn(response);

            // Act
            String token = service.getAccessToken();

            // Assert
            assertThat(token).isEqualTo("new-token");
        }
    }

    // ===================================================================
    // validateDeviceId
    // ===================================================================

    @Nested
    @DisplayName("Device ID validation")
    class ValidateDeviceId {

        @Test
        @DisplayName("rejects null device ID")
        void whenNullDeviceId_thenThrows() {
            assertThatThrownBy(() -> service.getDeviceInfo(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Device ID invalide");
        }

        @Test
        @DisplayName("rejects path traversal attempts")
        void whenDeviceIdWithPathTraversal_thenThrows() {
            assertThatThrownBy(() -> service.getDeviceInfo("../../../etc/passwd"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Device ID invalide");
        }

        @Test
        @DisplayName("rejects script injection in device ID")
        void whenDeviceIdWithSpecialChars_thenThrows() {
            assertThatThrownBy(() -> service.getDeviceInfo("device<script>"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Device ID invalide");
        }

        @Test
        @DisplayName("rejects device ID exceeding 64 characters")
        void whenDeviceIdTooLong_thenThrows() {
            // Arrange
            String longId = "a".repeat(65);

            // Act & Assert
            assertThatThrownBy(() -> service.getDeviceInfo(longId))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Device ID invalide");
        }

        @Test
        @DisplayName("rejects device ID with spaces")
        void whenDeviceIdWithSpaces_thenThrows() {
            assertThatThrownBy(() -> service.getDeviceInfo("device id"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Device ID invalide");
        }

        @Test
        @DisplayName("accepts valid alphanumeric device ID")
        void whenValidAlphanumericId_thenDoesNotThrowValidationError() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of("id", "valid-device-123");
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    eq(Map.class))).thenReturn(response);

            // Act
            Map<String, Object> deviceInfo = service.getDeviceInfo("valid-device-123");

            // Assert
            assertThat(deviceInfo).containsEntry("id", "valid-device-123");
        }

        @Test
        @DisplayName("accepts device ID with underscores and hyphens")
        void whenIdWithUnderscoresAndHyphens_thenAccepts() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of("id", "device_id-123");
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    eq(Map.class))).thenReturn(response);

            // Act & Assert (no IllegalArgumentException)
            Map<String, Object> deviceInfo = service.getDeviceInfo("device_id-123");
            assertThat(deviceInfo).isNotNull();
        }
    }

    // ===================================================================
    // getDeviceInfo
    // ===================================================================

    @Nested
    @DisplayName("getDeviceInfo")
    class GetDeviceInfo {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("returns device info from API")
        void whenDeviceExists_thenReturnsInfo() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of("id", "dev-1", "name", "Noise Sensor");
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    eq(Map.class))).thenReturn(response);

            // Act
            Map<String, Object> info = service.getDeviceInfo("dev-1");

            // Assert
            assertThat(info).containsEntry("id", "dev-1");
            assertThat(info).containsEntry("name", "Noise Sensor");
        }
    }

    // ===================================================================
    // getDeviceStatus
    // ===================================================================

    @Nested
    @DisplayName("getDeviceStatus")
    class GetDeviceStatus {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("returns device status")
        void whenCalled_thenReturnsStatus() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of("code", "noise_value", "value", 65);
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(contains("/status"), eq(HttpMethod.GET),
                    any(HttpEntity.class), eq(Map.class))).thenReturn(response);

            // Act
            Map<String, Object> status = service.getDeviceStatus("dev-1");

            // Assert
            assertThat(status).containsKey("code");
        }
    }

    // ===================================================================
    // getDeviceLogs
    // ===================================================================

    @Nested
    @DisplayName("getDeviceLogs")
    class GetDeviceLogs {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("returns device logs with time range")
        void whenCalled_thenReturnsLogs() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> result = Map.of("logs", List.of());
            Map<String, Object> body = Map.of("success", true, "result", result);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(contains("/logs"), eq(HttpMethod.GET),
                    any(HttpEntity.class), eq(Map.class))).thenReturn(response);

            // Act
            Map<String, Object> logs = service.getDeviceLogs("dev-1", 1000L, 2000L);

            // Assert
            assertThat(logs).containsKey("logs");
        }
    }

    // ===================================================================
    // sendCommand
    // ===================================================================

    @Nested
    @DisplayName("sendCommand")
    class SendCommand {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("sends command to device via POST")
        void whenCalled_thenSendsCommand() {
            // Arrange
            stubTokenResponse();
            when(config.getAccessId()).thenReturn("test-id");
            when(config.getAccessSecret()).thenReturn("test-secret-key-1234567890123456");
            when(config.getApiBaseUrl()).thenReturn("https://openapi.tuyaeu.com");

            Map<String, Object> body = Map.of("success", true, "result", true);
            ResponseEntity<Map> response = new ResponseEntity<>(body, HttpStatus.OK);
            when(restTemplate.exchange(contains("/commands"), eq(HttpMethod.POST),
                    any(HttpEntity.class), eq(Map.class))).thenReturn(response);

            List<Map<String, Object>> commands = List.of(
                    Map.of("code", "switch", "value", true)
            );

            // Act
            Map<String, Object> result = service.sendCommand("dev-1", commands);

            // Assert
            assertThat(result).containsKey("result");
        }
    }

    // ===================================================================
    // createConnection
    // ===================================================================

    @Nested
    @DisplayName("createConnection")
    class CreateConnection {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("creates connection after obtaining token")
        void whenCalled_thenCreatesConnection() {
            // Arrange
            // Set up cached token for getAccessToken()
            ReflectionTestUtils.setField(service, "cachedAccessToken", "access-token");
            ReflectionTestUtils.setField(service, "cachedRefreshToken", "refresh-token");
            ReflectionTestUtils.setField(service, "cachedTokenExpiry",
                    LocalDateTime.now().plusHours(1));

            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());
            when(encryptionService.encrypt("access-token")).thenReturn("enc-access");
            when(encryptionService.encrypt("refresh-token")).thenReturn("enc-refresh");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
            when(connectionRepository.save(any(TuyaConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            TuyaConnection result = service.createConnection("user-1");

            // Assert
            assertThat(result.getUserId()).isEqualTo("user-1");
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-access");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-refresh");
            assertThat(result.getStatus()).isEqualTo(TuyaConnectionStatus.ACTIVE);
            assertThat(result.getOrganizationId()).isEqualTo(10L);
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("reuses existing connection when present")
        void whenExistingConnection_thenReuses() {
            // Arrange
            ReflectionTestUtils.setField(service, "cachedAccessToken", "access-token");
            ReflectionTestUtils.setField(service, "cachedRefreshToken", null);
            ReflectionTestUtils.setField(service, "cachedTokenExpiry",
                    LocalDateTime.now().plusHours(1));

            TuyaConnection existing = new TuyaConnection();
            existing.setId(5L);
            existing.setUserId("user-1");
            existing.setOrganizationId(10L);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(existing));
            when(encryptionService.encrypt("access-token")).thenReturn("enc-access");
            when(connectionRepository.save(any(TuyaConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            TuyaConnection result = service.createConnection("user-1");

            // Assert
            assertThat(result.getId()).isEqualTo(5L); // reused existing
            assertThat(result.getOrganizationId()).isEqualTo(10L);
        }
    }

    // ===================================================================
    // disconnect
    // ===================================================================

    @Nested
    @DisplayName("disconnect")
    class Disconnect {

        @Test
        @DisplayName("revokes connection and clears cache")
        void whenConnectionExists_thenRevokes() {
            // Arrange
            TuyaConnection conn = new TuyaConnection();
            conn.setStatus(TuyaConnectionStatus.ACTIVE);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act
            service.disconnect("user-1");

            // Assert
            verify(connectionRepository).save(argThat(c ->
                    c.getStatus() == TuyaConnectionStatus.REVOKED));
        }

        @Test
        @DisplayName("does nothing when no connection exists")
        void whenNoConnection_thenDoesNothing() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act
            service.disconnect("user-X");

            // Assert
            verify(connectionRepository, never()).save(any());
        }
    }

    // ===================================================================
    // isConnected
    // ===================================================================

    @Nested
    @DisplayName("isConnected")
    class IsConnected {

        @Test
        @DisplayName("returns true for active connection")
        void whenActiveConnection_thenReturnsTrue() {
            // Arrange
            TuyaConnection conn = new TuyaConnection();
            conn.setStatus(TuyaConnectionStatus.ACTIVE);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThat(service.isConnected("user-1")).isTrue();
        }

        @Test
        @DisplayName("returns false when no connection")
        void whenNoConnection_thenReturnsFalse() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act & Assert
            assertThat(service.isConnected("user-X")).isFalse();
        }

        @Test
        @DisplayName("returns false for revoked connection")
        void whenRevokedConnection_thenReturnsFalse() {
            // Arrange
            TuyaConnection conn = new TuyaConnection();
            conn.setStatus(TuyaConnectionStatus.REVOKED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThat(service.isConnected("user-1")).isFalse();
        }
    }

    // ===================================================================
    // getConnectionStatus
    // ===================================================================

    @Nested
    @DisplayName("getConnectionStatus")
    class GetConnectionStatus {

        @Test
        @DisplayName("returns present when connection exists")
        void whenConnectionExists_thenReturnsPresent() {
            // Arrange
            TuyaConnection conn = new TuyaConnection();
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThat(service.getConnectionStatus("user-1")).isPresent();
        }

        @Test
        @DisplayName("returns empty when no connection")
        void whenNoConnection_thenReturnsEmpty() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act & Assert
            assertThat(service.getConnectionStatus("user-X")).isEmpty();
        }
    }
}
