package com.clenzy.integration.minut.service;

import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MinutOAuthServiceTest {

    @Mock private MinutConfig config;
    @Mock private MinutConnectionRepository connectionRepository;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private TenantContext tenantContext;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private RestTemplate restTemplate;

    private MinutOAuthService service;

    @BeforeEach
    void setUp() {
        service = new MinutOAuthService(config, connectionRepository, encryptionService,
                tenantContext, redisTemplate, restTemplate);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    class GetAuthorizationUrl {

        @Test
        void whenConfigured_thenReturnsUrlWithRandomState() {
            when(config.isConfigured()).thenReturn(true);
            when(config.getAuthorizationUrl()).thenReturn("https://minut.com/oauth/authorize");
            when(config.getClientId()).thenReturn("minut-client");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/minut/callback");
            when(config.getScopes()).thenReturn("read");
            when(redisTemplate.opsForValue()).thenReturn(valueOps);

            String url = service.getAuthorizationUrl("user-1");

            assertThat(url).contains("client_id=minut-client");
            assertThat(url).contains("response_type=code");
            assertThat(url).contains("state=");
            verify(valueOps).set(anyString(), eq("user-1"), any());
        }

        @Test
        void whenNotConfigured_thenThrows() {
            when(config.isConfigured()).thenReturn(false);

            assertThatThrownBy(() -> service.getAuthorizationUrl("user-1"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Configuration Minut incomplete");
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    class ValidateAndConsumeState {

        @Test
        void whenValidState_thenReturnsUserIdAndDeletes() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:minut:state:valid-state")).thenReturn("user-1");

            String userId = service.validateAndConsumeState("valid-state");

            assertThat(userId).isEqualTo("user-1");
            verify(redisTemplate).delete("oauth:minut:state:valid-state");
        }

        @Test
        void whenInvalidState_thenThrowsSecurityException() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:minut:state:invalid")).thenReturn(null);

            assertThatThrownBy(() -> service.validateAndConsumeState("invalid"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Invalid or expired");
        }
    }

    // ===== GET VALID ACCESS TOKEN =====

    @Nested
    class GetValidAccessToken {

        @Test
        void whenNoConnection_thenThrows() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getValidAccessToken("user-1"))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenConnectionInactive_thenThrows() {
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.REVOKED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThatThrownBy(() -> service.getValidAccessToken("user-1"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("inactive");
        }

        @Test
        void whenTokenNotExpired_thenReturnsDecrypted() {
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.ACTIVE);
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
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.ACTIVE);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            assertThat(service.isConnected("user-1")).isTrue();
        }

        @Test
        void whenNoConnection_thenFalse() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            assertThat(service.isConnected("user-1")).isFalse();
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    class RefreshToken {

        @Test
        void whenNoRefreshToken_thenMarksExpired() {
            MinutConnection conn = new MinutConnection();
            conn.setRefreshTokenEncrypted("encrypted");
            when(encryptionService.decrypt("encrypted")).thenReturn(null);
            when(connectionRepository.save(any(MinutConnection.class))).thenAnswer(inv -> inv.getArgument(0));

            MinutConnection result = service.refreshToken(conn);

            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.EXPIRED);
        }
    }

    // ===== REVOKE TOKEN =====

    @Nested
    class RevokeToken {

        @Test
        void whenNoConnection_thenDoesNothing() {
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());

            service.revokeToken("user-1");

            verify(connectionRepository, never()).save(any());
        }
    }
}
