package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
    }
}
