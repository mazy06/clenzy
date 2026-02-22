package com.clenzy.integration.minut.service;

import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link MinutOAuthService}.
 * Covers authorization URL generation, state validation, token exchange,
 * token refresh, access token retrieval, revocation, and connection status.
 */
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

    private MinutConnection createActiveConnection(String userId) {
        MinutConnection conn = new MinutConnection();
        conn.setId(1L);
        conn.setUserId(userId);
        conn.setStatus(MinutConnectionStatus.ACTIVE);
        conn.setAccessTokenEncrypted("encrypted-access");
        conn.setRefreshTokenEncrypted("encrypted-refresh");
        conn.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
        conn.setOrganizationId(10L);
        return conn;
    }

    // ===================================================================
    // getAuthorizationUrl
    // ===================================================================

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("returns URL with random state stored in Redis")
        void whenConfigured_thenReturnsUrlWithRandomState() {
            // Arrange
            when(config.isConfigured()).thenReturn(true);
            when(config.getAuthorizationUrl()).thenReturn("https://api.minut.com/v8/oauth/authorize");
            when(config.getClientId()).thenReturn("minut-client");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/minut/callback");
            when(config.getScopes()).thenReturn("read,write");
            when(redisTemplate.opsForValue()).thenReturn(valueOps);

            // Act
            String url = service.getAuthorizationUrl("user-1");

            // Assert
            assertThat(url).contains("client_id=minut-client");
            assertThat(url).contains("redirect_uri=https://clenzy.fr/minut/callback");
            assertThat(url).contains("scope=read,write");
            assertThat(url).contains("response_type=code");
            assertThat(url).contains("state=");
            verify(valueOps).set(argThat(key -> key.startsWith("oauth:minut:state:")),
                    eq("user-1"), any(Duration.class));
        }

        @Test
        @DisplayName("throws when configuration is incomplete")
        void whenNotConfigured_thenThrows() {
            // Arrange
            when(config.isConfigured()).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> service.getAuthorizationUrl("user-1"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Configuration Minut incomplete");
        }
    }

    // ===================================================================
    // validateAndConsumeState
    // ===================================================================

    @Nested
    @DisplayName("validateAndConsumeState")
    class ValidateAndConsumeState {

        @Test
        @DisplayName("returns userId and deletes state from Redis when valid")
        void whenValidState_thenReturnsUserIdAndDeletes() {
            // Arrange
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:minut:state:valid-state")).thenReturn("user-1");

            // Act
            String userId = service.validateAndConsumeState("valid-state");

            // Assert
            assertThat(userId).isEqualTo("user-1");
            verify(redisTemplate).delete("oauth:minut:state:valid-state");
        }

        @Test
        @DisplayName("throws SecurityException when state is invalid or expired")
        void whenInvalidState_thenThrowsSecurityException() {
            // Arrange
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:minut:state:invalid")).thenReturn(null);

            // Act & Assert
            assertThatThrownBy(() -> service.validateAndConsumeState("invalid"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Invalid or expired");
        }
    }

    // ===================================================================
    // exchangeCodeForToken
    // ===================================================================

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCodeForToken {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("saves connection with encrypted tokens on success")
        void whenSuccessfulExchange_thenSavesConnection() {
            // Arrange
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/callback");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");
            when(config.getScopes()).thenReturn("read,write");

            Map<String, Object> tokenResponse = Map.of(
                    "access_token", "new-access-token",
                    "refresh_token", "new-refresh-token",
                    "expires_in", 7200,
                    "user_id", "minut-user-42"
            );
            ResponseEntity<Map> response = new ResponseEntity<>(tokenResponse, HttpStatus.OK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);

            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.empty());
            when(encryptionService.encrypt("new-access-token")).thenReturn("enc-access");
            when(encryptionService.encrypt("new-refresh-token")).thenReturn("enc-refresh");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.exchangeCodeForToken("auth-code", "user-1");

            // Assert
            assertThat(result.getUserId()).isEqualTo("user-1");
            assertThat(result.getMinutUserId()).isEqualTo("minut-user-42");
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-access");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-refresh");
            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.ACTIVE);
            assertThat(result.getOrganizationId()).isEqualTo(10L);
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("updates existing connection instead of creating new one")
        void whenExistingConnection_thenUpdates() {
            // Arrange
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/callback");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");
            when(config.getScopes()).thenReturn("read,write");

            Map<String, Object> tokenResponse = Map.of(
                    "access_token", "new-token",
                    "refresh_token", "new-refresh",
                    "expires_in", 3600
            );
            ResponseEntity<Map> response = new ResponseEntity<>(tokenResponse, HttpStatus.OK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);

            MinutConnection existing = createActiveConnection("user-1");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(existing));
            when(encryptionService.encrypt(anyString())).thenReturn("encrypted");
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.exchangeCodeForToken("code", "user-1");

            // Assert
            assertThat(result.getId()).isEqualTo(1L); // reused existing
            assertThat(result.getOrganizationId()).isEqualTo(10L); // kept existing orgId
        }
    }

    // ===================================================================
    // refreshToken
    // ===================================================================

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("updates tokens on successful refresh")
        void whenSuccessfulRefresh_thenUpdatesTokens() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(encryptionService.decrypt("encrypted-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");

            Map<String, Object> tokenResponse = Map.of(
                    "access_token", "refreshed-access",
                    "refresh_token", "refreshed-refresh",
                    "expires_in", 7200
            );
            ResponseEntity<Map> response = new ResponseEntity<>(tokenResponse, HttpStatus.OK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);
            when(encryptionService.encrypt("refreshed-access")).thenReturn("enc-refreshed-access");
            when(encryptionService.encrypt("refreshed-refresh")).thenReturn("enc-refreshed-refresh");
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.refreshToken(conn);

            // Assert
            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.ACTIVE);
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-refreshed-access");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-refreshed-refresh");
            assertThat(result.getErrorMessage()).isNull();
        }

        @Test
        @DisplayName("marks as EXPIRED when refresh token is missing")
        void whenNoRefreshToken_thenMarksExpired() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            conn.setRefreshTokenEncrypted("encrypted");
            when(encryptionService.decrypt("encrypted")).thenReturn(null);
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.refreshToken(conn);

            // Assert
            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.EXPIRED);
            assertThat(result.getErrorMessage()).contains("Refresh token manquant");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("marks as ERROR when API returns non-2xx")
        void whenErrorResponse_thenMarksError() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(encryptionService.decrypt("encrypted-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");

            ResponseEntity<Map> errorResponse = new ResponseEntity<>(null, HttpStatus.UNAUTHORIZED);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(errorResponse);
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.refreshToken(conn);

            // Assert
            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.ERROR);
            assertThat(result.getErrorMessage()).contains("Echec refresh");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("marks as ERROR when exception is thrown")
        void whenExceptionThrown_thenMarksError() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(encryptionService.decrypt("encrypted-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenThrow(new RuntimeException("Network error"));
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            MinutConnection result = service.refreshToken(conn);

            // Assert
            assertThat(result.getStatus()).isEqualTo(MinutConnectionStatus.ERROR);
            assertThat(result.getErrorMessage()).contains("Network error");
        }
    }

    // ===================================================================
    // getValidAccessToken
    // ===================================================================

    @Nested
    @DisplayName("getValidAccessToken")
    class GetValidAccessToken {

        @Test
        @DisplayName("returns decrypted token when active and not expired")
        void whenTokenNotExpired_thenReturnsDecrypted() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-access")).thenReturn("plain-access-token");

            // Act
            String token = service.getValidAccessToken("user-1");

            // Assert
            assertThat(token).isEqualTo("plain-access-token");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("refreshes token when about to expire (within 5 min)")
        void whenTokenExpiringSoon_thenRefreshes() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            conn.setTokenExpiresAt(LocalDateTime.now().plusMinutes(3)); // expires in 3 min < 5 min threshold
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-refresh")).thenReturn("plain-refresh");
            when(config.getClientId()).thenReturn("client-id");
            when(config.getClientSecret()).thenReturn("client-secret");
            when(config.getTokenUrl()).thenReturn("https://api.minut.com/v8/oauth/token");

            Map<String, Object> tokenResponse = Map.of(
                    "access_token", "refreshed-token",
                    "expires_in", 3600
            );
            ResponseEntity<Map> response = new ResponseEntity<>(tokenResponse, HttpStatus.OK);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(response);
            when(encryptionService.encrypt("refreshed-token")).thenReturn("enc-refreshed");
            when(connectionRepository.save(any(MinutConnection.class)))
                    .thenAnswer(inv -> {
                        MinutConnection c = inv.getArgument(0);
                        c.setAccessTokenEncrypted("enc-refreshed");
                        return c;
                    });
            when(encryptionService.decrypt("enc-refreshed")).thenReturn("refreshed-token");

            // Act
            String token = service.getValidAccessToken("user-1");

            // Assert
            assertThat(token).isEqualTo("refreshed-token");
        }

        @Test
        @DisplayName("throws when no connection found")
        void whenNoConnection_thenThrows() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getValidAccessToken("user-X"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Aucune connexion Minut");
        }

        @Test
        @DisplayName("throws when connection is inactive")
        void whenConnectionInactive_thenThrows() {
            // Arrange
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.REVOKED);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThatThrownBy(() -> service.getValidAccessToken("user-1"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("inactive");
        }
    }

    // ===================================================================
    // revokeToken
    // ===================================================================

    @Nested
    @DisplayName("revokeToken")
    class RevokeToken {

        @Test
        @DisplayName("revokes token via API and marks connection as REVOKED")
        void whenConnectionExists_thenRevokesAndSaves() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-access")).thenReturn("plain-access");
            when(config.getApiBaseUrl()).thenReturn("https://api.minut.com/v8");
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Void.class)))
                    .thenReturn(new ResponseEntity<>(HttpStatus.OK));

            // Act
            service.revokeToken("user-1");

            // Assert
            verify(connectionRepository).save(argThat(c ->
                    c.getStatus() == MinutConnectionStatus.REVOKED));
            verify(restTemplate).postForEntity(
                    contains("/oauth/revoke"), any(HttpEntity.class), eq(Void.class));
        }

        @Test
        @DisplayName("does nothing when no connection exists")
        void whenNoConnection_thenDoesNothing() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act
            service.revokeToken("user-X");

            // Assert
            verify(connectionRepository, never()).save(any());
        }

        @Test
        @DisplayName("still marks as REVOKED even if API revocation fails")
        void whenRevocationApiFails_thenStillMarksRevoked() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-access")).thenReturn("plain-access");
            when(config.getApiBaseUrl()).thenReturn("https://api.minut.com/v8");
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Void.class)))
                    .thenThrow(new RuntimeException("API unavailable"));

            // Act
            service.revokeToken("user-1");

            // Assert
            verify(connectionRepository).save(argThat(c ->
                    c.getStatus() == MinutConnectionStatus.REVOKED));
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
        void whenActive_thenTrue() {
            // Arrange
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.ACTIVE);
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThat(service.isConnected("user-1")).isTrue();
        }

        @Test
        @DisplayName("returns false when no connection exists")
        void whenNoConnection_thenFalse() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act & Assert
            assertThat(service.isConnected("user-X")).isFalse();
        }

        @Test
        @DisplayName("returns false for revoked connection")
        void whenRevoked_thenFalse() {
            // Arrange
            MinutConnection conn = new MinutConnection();
            conn.setStatus(MinutConnectionStatus.REVOKED);
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
        void whenExists_thenPresent() {
            // Arrange
            MinutConnection conn = createActiveConnection("user-1");
            when(connectionRepository.findByUserId("user-1")).thenReturn(Optional.of(conn));

            // Act & Assert
            assertThat(service.getConnectionStatus("user-1")).isPresent();
        }

        @Test
        @DisplayName("returns empty when no connection")
        void whenNotExists_thenEmpty() {
            // Arrange
            when(connectionRepository.findByUserId("user-X")).thenReturn(Optional.empty());

            // Act & Assert
            assertThat(service.getConnectionStatus("user-X")).isEmpty();
        }
    }
}
