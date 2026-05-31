package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AirbnbOAuthServiceTest {

    @Mock private AirbnbConfig config;
    @Mock private AirbnbConnectionRepository connectionRepository;
    @Mock private AirbnbTokenEncryptionService encryptionService;
    @Mock private AuditLogService auditLogService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private RestTemplate restTemplate;

    private AirbnbOAuthService service;

    @BeforeEach
    void setUp() {
        service = new AirbnbOAuthService(config, connectionRepository, encryptionService,
                auditLogService, redisTemplate, restTemplate);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    class GetAuthorizationUrl {

        @Test
        void whenConfigured_thenReturnsUrlWithState() {
            when(config.isConfigured()).thenReturn(true);
            when(config.getAuthorizationUrl()).thenReturn("https://airbnb.com/oauth/authorize");
            when(config.getClientId()).thenReturn("client-id");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/callback");
            when(config.getScopes()).thenReturn("read_write");
            when(redisTemplate.opsForValue()).thenReturn(valueOps);

            String url = service.getAuthorizationUrl("user-1");

            assertThat(url).contains("client_id=client-id");
            assertThat(url).contains("response_type=code");
            assertThat(url).contains("state=");
            verify(valueOps).set(anyString(), eq("user-1"), any());
        }

        @Test
        void whenNotConfigured_thenThrows() {
            when(config.isConfigured()).thenReturn(false);

            assertThatThrownBy(() -> service.getAuthorizationUrl("user-1"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Configuration Airbnb incomplete");
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    class ValidateAndConsumeState {

        @Test
        void whenValidState_thenReturnsUserIdAndDeletes() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:airbnb:state:valid-state")).thenReturn("user-1");

            String userId = service.validateAndConsumeState("valid-state");

            assertThat(userId).isEqualTo("user-1");
            verify(redisTemplate).delete("oauth:airbnb:state:valid-state");
        }

        @Test
        void whenInvalidState_thenThrowsSecurityException() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:airbnb:state:invalid")).thenReturn(null);

            assertThatThrownBy(() -> service.validateAndConsumeState("invalid"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Invalid or expired");
        }
    }

    // ===== GET VALID ACCESS TOKEN =====

    @Nested
    class GetValidAccessToken {

        @Test
        void whenConnectionNotFound_thenThrows() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getValidAccessToken("user-1"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenConnectionNotActive_thenThrows() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThatThrownBy(() -> service.getValidAccessToken("user-1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non active");
        }

        @Test
        void whenTokenNotExpired_thenReturnsDecrypted() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            conn.setAccessTokenEncrypted("encrypted-token");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-token")).thenReturn("decrypted-token");

            String token = service.getValidAccessToken("user-1");

            assertThat(token).isEqualTo("decrypted-token");
        }
    }

    // ===== IS CONNECTED =====

    @Nested
    class IsConnected {

        @Test
        void whenActiveConnection_thenTrue() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThat(service.isConnected("user-1")).isTrue();
        }

        @Test
        void whenNoConnection_thenFalse() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThat(service.isConnected("user-1")).isFalse();
        }
    }

    // ===== REVOKE TOKEN =====

    @Nested
    class RevokeToken {

        @Test
        void whenNoConnection_thenThrows() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.revokeToken("user-1"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    class RefreshToken {

        @Test
        void whenNoConnection_thenThrows() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refreshToken("user-1"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenNoRefreshToken_thenThrows() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setRefreshTokenEncrypted("encrypted");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted")).thenReturn(null);

            assertThatThrownBy(() -> service.refreshToken("user-1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("refresh token");
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on success: persists new access + refresh + expiresAt, status ACTIVE")
        void whenSuccess_persistsNewTokens() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setRefreshTokenEncrypted("enc-refresh");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-access");
            body.put("refresh_token", "new-refresh");
            body.put("expires_in", 7200);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-access")).thenReturn("enc-new-access");
            when(encryptionService.encrypt("new-refresh")).thenReturn("enc-new-refresh");
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            AirbnbConnection result = service.refreshToken("user-1");

            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-new-access");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-new-refresh");
            assertThat(result.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            assertThat(result.getErrorMessage()).isNull();
            assertThat(result.getTokenExpiresAt()).isAfter(LocalDateTime.now().plusHours(1));
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on success without new refresh_token: keeps existing refresh token")
        void whenSuccessNoNewRefreshToken_keepsExisting() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setRefreshTokenEncrypted("enc-refresh");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-access");
            body.put("expires_in", 7200);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-access")).thenReturn("enc-new-access");
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            AirbnbConnection result = service.refreshToken("user-1");

            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-refresh");
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on non-2xx response: marks EXPIRED + sets error, rethrows")
        void whenNon2xx_marksExpiredAndThrows() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setRefreshTokenEncrypted("enc-refresh");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(new ResponseEntity<>(HttpStatus.UNAUTHORIZED));

            assertThatThrownBy(() -> service.refreshToken("user-1"))
                    .isInstanceOf(RuntimeException.class);

            ArgumentCaptor<AirbnbConnection> captor = ArgumentCaptor.forClass(AirbnbConnection.class);
            verify(connectionRepository).save(captor.capture());
            AirbnbConnection saved = captor.getValue();
            assertThat(saved.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.EXPIRED);
            assertThat(saved.getErrorMessage()).contains("Refresh");
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on RestClientException: marks EXPIRED + sets error, rethrows")
        void whenRestClientException_marksExpiredAndThrows() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setRefreshTokenEncrypted("enc-refresh");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenThrow(new RestClientException("timeout"));

            assertThatThrownBy(() -> service.refreshToken("user-1"))
                    .isInstanceOf(RuntimeException.class);
            verify(connectionRepository).save(any(AirbnbConnection.class));
        }
    }

    // ===== EXCHANGE CODE FOR TOKEN =====

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCodeForToken {

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("creates new connection on success when none exists")
        void whenNoExistingConnection_createsNew() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");
            when(config.getScopes()).thenReturn("read");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "at");
            body.put("refresh_token", "rt");
            body.put("expires_in", 3600);
            body.put("user_id", 999L);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(body));
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());
            when(encryptionService.encrypt("at")).thenReturn("enc-at");
            when(encryptionService.encrypt("rt")).thenReturn("enc-rt");
            when(connectionRepository.save(any(AirbnbConnection.class)))
                    .thenAnswer(inv -> {
                        AirbnbConnection c = inv.getArgument(0);
                        c.setId(1L);
                        return c;
                    });

            AirbnbConnection result = service.exchangeCodeForToken("auth-code-xyz", "user-1");

            assertThat(result.getUserId()).isEqualTo("user-1");
            assertThat(result.getAirbnbUserId()).isEqualTo("999");
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-at");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-rt");
            assertThat(result.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            assertThat(result.getScopes()).isEqualTo("read");
            assertThat(result.getConnectedAt()).isNotNull();
            verify(auditLogService).logSync(eq("AirbnbConnection"), anyString(), anyString());
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("updates existing connection on success")
        void whenExistingConnection_updates() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");
            when(config.getScopes()).thenReturn("read");

            AirbnbConnection existing = new AirbnbConnection();
            existing.setId(5L);
            existing.setConnectedAt(LocalDateTime.now().minusDays(10));
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(existing));

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-at");
            body.put("refresh_token", "new-rt");
            body.put("expires_in", 3600);
            body.put("user_id", 999L);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-at")).thenReturn("enc-new-at");
            when(encryptionService.encrypt("new-rt")).thenReturn("enc-new-rt");
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            AirbnbConnection result = service.exchangeCodeForToken("auth-code-xyz", "user-1");

            assertThat(result.getId()).isEqualTo(5L);
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-new-at");
            // Should keep original connectedAt
            assertThat(result.getConnectedAt()).isBefore(LocalDateTime.now().minusDays(1));
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on non-2xx: marks existing connection ERROR + rethrows")
        void whenNon2xx_marksConnectionError() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            AirbnbConnection existing = new AirbnbConnection();
            existing.setId(5L);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(existing));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(new ResponseEntity<>(HttpStatus.BAD_REQUEST));

            assertThatThrownBy(() -> service.exchangeCodeForToken("code", "user-1"))
                    .isInstanceOf(RuntimeException.class);

            verify(connectionRepository, atLeastOnce()).save(any(AirbnbConnection.class));
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("on RestClientException: rethrows and marks error")
        void whenException_rethrows() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenThrow(new RestClientException("conn refused"));
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.exchangeCodeForToken("code", "user-1"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== REVOKE TOKEN (extended) =====

    @Nested
    @DisplayName("revokeToken extended")
    class RevokeTokenExtended {

        @Test
        @DisplayName("marks REVOKED and clears tokens on success")
        void whenSuccess_marksRevoked() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setId(1L);
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setAccessTokenEncrypted("enc-at");
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-at")).thenReturn("plain-at");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getApiBaseUrl()).thenReturn("https://api.airbnb.com");
            when(restTemplate.postForEntity(anyString(), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            service.revokeToken("user-1");

            assertThat(conn.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            assertThat(conn.getAccessTokenEncrypted()).isNull();
            assertThat(conn.getRefreshTokenEncrypted()).isNull();
            assertThat(conn.getTokenExpiresAt()).isNull();
            verify(auditLogService).logSync(eq("AirbnbConnection"), anyString(), anyString());
        }

        @Test
        @DisplayName("still marks REVOKED when remote API call fails (non-blocking)")
        void whenRemoteFails_stillMarksRevoked() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setId(1L);
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setAccessTokenEncrypted("enc-at");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-at")).thenReturn("plain-at");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getApiBaseUrl()).thenReturn("https://api.airbnb.com");
            when(restTemplate.postForEntity(anyString(), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("network down"));
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            service.revokeToken("user-1");

            assertThat(conn.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
        }
    }

    // ===== GET VALID ACCESS TOKEN — AUTO REFRESH =====

    @Nested
    @DisplayName("getValidAccessToken — auto refresh")
    class GetValidAccessTokenAutoRefresh {

        @SuppressWarnings({"rawtypes", "unchecked"})
        @Test
        @DisplayName("auto-refreshes when token expires within 5 minutes")
        void autoRefreshesNearExpiry() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusMinutes(2)); // close to expiry
            conn.setAccessTokenEncrypted("old-enc");
            conn.setRefreshTokenEncrypted("rt-enc");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("rt-enc")).thenReturn("rt-plain");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://airbnb.com/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-at");
            body.put("expires_in", 3600);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-at")).thenReturn("new-enc");
            when(connectionRepository.save(any(AirbnbConnection.class))).thenAnswer(inv -> inv.getArgument(0));
            when(encryptionService.decrypt("new-enc")).thenReturn("new-plain");

            String token = service.getValidAccessToken("user-1");

            assertThat(token).isEqualTo("new-plain");
        }
    }

    // ===== GET CONNECTION STATUS =====

    @Nested
    @DisplayName("getConnectionStatus")
    class GetConnectionStatus {

        @Test
        @DisplayName("returns Optional from repository")
        void delegatesToRepository() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ERROR);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            Optional<AirbnbConnection> result = service.getConnectionStatus("user-1");

            assertThat(result).isPresent();
            assertThat(result.get().getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.ERROR);
        }

        @Test
        @DisplayName("returns empty when no connection")
        void emptyWhenNotFound() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThat(service.getConnectionStatus("user-1")).isEmpty();
        }
    }

    // ===== IS CONNECTED — extended =====

    @Nested
    @DisplayName("isConnected — extended")
    class IsConnectedExtended {

        @Test
        @DisplayName("returns false when connection is REVOKED")
        void whenRevoked_returnsFalse() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThat(service.isConnected("user-1")).isFalse();
        }

        @Test
        @DisplayName("returns false when connection is EXPIRED")
        void whenExpired_returnsFalse() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.EXPIRED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThat(service.isConnected("user-1")).isFalse();
        }

        @Test
        @DisplayName("returns false when connection has ERROR status")
        void whenError_returnsFalse() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ERROR);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThat(service.isConnected("user-1")).isFalse();
        }
    }
}
