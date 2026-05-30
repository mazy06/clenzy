package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HomeAwayOAuthServiceTest {

    @Mock private HomeAwayConfig config;
    @Mock private HomeAwayConnectionRepository connectionRepository;
    @Mock private AirbnbTokenEncryptionService encryptionService;
    @Mock private AuditLogService auditLogService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private RestTemplate restTemplate;

    private HomeAwayOAuthService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new HomeAwayOAuthService(
                config, connectionRepository, encryptionService,
                auditLogService, redisTemplate, restTemplate
        );
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("returns URL with client_id, redirect_uri and state when configured")
        void getAuthorizationUrl_configured_returnsUrl() {
            when(config.isConfigured()).thenReturn(true);
            when(config.getAuthorizationUrl()).thenReturn("https://ws.homeaway.com/oauth/authorize");
            when(config.getClientId()).thenReturn("ha-client-id");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/callback/homeaway");
            when(redisTemplate.opsForValue()).thenReturn(valueOps);

            String url = service.getAuthorizationUrl(ORG_ID);

            assertThat(url).contains("client_id=ha-client-id");
            assertThat(url).contains("redirect_uri=https://clenzy.fr/callback/homeaway");
            assertThat(url).contains("response_type=code");
            assertThat(url).contains("state=");
            verify(valueOps).set(startsWith("oauth:homeaway:state:"), eq(ORG_ID.toString()), any());
        }

        @Test
        @DisplayName("throws IllegalStateException when HomeAway not configured")
        void getAuthorizationUrl_notConfigured_throws() {
            when(config.isConfigured()).thenReturn(false);

            assertThatThrownBy(() -> service.getAuthorizationUrl(ORG_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Configuration HomeAway incomplete");
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    @DisplayName("validateAndConsumeState")
    class ValidateAndConsumeState {

        @Test
        @DisplayName("returns orgId and deletes state from Redis when valid")
        void validateAndConsumeState_validState_returnsUserId() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:homeaway:state:valid-state")).thenReturn("1");

            Long result = service.validateAndConsumeState("valid-state");

            assertThat(result).isEqualTo(1L);
            verify(redisTemplate).delete("oauth:homeaway:state:valid-state");
        }

        @Test
        @DisplayName("throws SecurityException when state is invalid or expired")
        void validateAndConsumeState_invalidState_throws() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("oauth:homeaway:state:bad-state")).thenReturn(null);

            assertThatThrownBy(() -> service.validateAndConsumeState("bad-state"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Invalid or expired");
        }
    }

    // ===== IS CONNECTED =====

    @Nested
    @DisplayName("isConnected")
    class IsConnected {

        @Test
        @DisplayName("returns true when active connection exists")
        void isConnected_activeConnection_returnsTrue() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            assertThat(service.isConnected(ORG_ID)).isTrue();
        }

        @Test
        @DisplayName("returns false when no connection exists")
        void isConnected_noConnection_returnsFalse() {
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.isConnected(ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("returns false when connection is not active")
        void isConnected_inactiveConnection_returnsFalse() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.EXPIRED);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            assertThat(service.isConnected(ORG_ID)).isFalse();
        }
    }

    // ===== GET VALID ACCESS TOKEN =====

    @Nested
    @DisplayName("getValidAccessToken")
    class GetValidAccessToken {

        @Test
        @DisplayName("throws when no connection exists")
        void getValidAccessToken_noConnection_throws() {
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getValidAccessToken(ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune connexion HomeAway");
        }

        @Test
        @DisplayName("throws when connection is not active")
        void getValidAccessToken_inactiveConnection_throws() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            assertThatThrownBy(() -> service.getValidAccessToken(ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non active");
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @Test
        @DisplayName("throws when no connection exists")
        void refreshToken_noConnection_throws() {
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refreshToken(ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune connexion HomeAway");
        }

        @Test
        @DisplayName("throws when no refresh token is available")
        void refreshToken_noRefreshToken_throws() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setRefreshTokenEncrypted("encrypted-refresh");
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("encrypted-refresh")).thenReturn(null);

            assertThatThrownBy(() -> service.refreshToken(ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("refresh token");
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("persists new tokens on successful refresh")
        void refreshToken_success_persists() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-rt")).thenReturn("plain-rt");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://ha/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-at");
            body.put("refresh_token", "new-rt");
            body.put("expires_in", 7200);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-at")).thenReturn("enc-new-at");
            when(encryptionService.encrypt("new-rt")).thenReturn("enc-new-rt");
            when(connectionRepository.save(any(HomeAwayConnection.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            HomeAwayConnection result = service.refreshToken(ORG_ID);

            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-new-at");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-new-rt");
            assertThat(result.getStatus()).isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            assertThat(result.getErrorMessage()).isNull();
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("keeps existing refresh token when not returned by HomeAway")
        void refreshToken_noNewRefresh_keepsExisting() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-rt")).thenReturn("plain-rt");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://ha/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-at");
            body.put("expires_in", 3600);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-at")).thenReturn("enc-new-at");
            when(connectionRepository.save(any(HomeAwayConnection.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            HomeAwayConnection result = service.refreshToken(ORG_ID);

            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-rt");
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("marks EXPIRED + sets error on non-2xx response")
        void refreshToken_non2xx_marksExpired() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-rt")).thenReturn("plain-rt");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(HttpStatus.UNAUTHORIZED));

            assertThatThrownBy(() -> service.refreshToken(ORG_ID))
                .isInstanceOf(RuntimeException.class);

            ArgumentCaptor<HomeAwayConnection> captor = ArgumentCaptor.forClass(HomeAwayConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                .isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.EXPIRED);
            assertThat(captor.getValue().getErrorMessage()).contains("Refresh");
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("marks EXPIRED + rethrows on RestClientException")
        void refreshToken_restClientException_marksExpired() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-rt")).thenReturn("plain-rt");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(new RestClientException("net down"));

            assertThatThrownBy(() -> service.refreshToken(ORG_ID))
                .isInstanceOf(RuntimeException.class);

            verify(connectionRepository).save(any(HomeAwayConnection.class));
        }
    }

    // ===== EXCHANGE CODE FOR TOKEN =====

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCodeForToken {

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("creates new connection on success when none exists")
        void noExisting_createsNew() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "at");
            body.put("refresh_token", "rt");
            body.put("expires_in", 3600);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
            when(encryptionService.encrypt("at")).thenReturn("enc-at");
            when(encryptionService.encrypt("rt")).thenReturn("enc-rt");
            when(connectionRepository.save(any(HomeAwayConnection.class)))
                .thenAnswer(inv -> {
                    HomeAwayConnection c = inv.getArgument(0);
                    c.setId(1L);
                    return c;
                });

            HomeAwayConnection result = service.exchangeCodeForToken("auth-code", ORG_ID);

            assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-at");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("enc-rt");
            assertThat(result.getStatus())
                .isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            assertThat(result.getErrorMessage()).isNull();
            verify(auditLogService).logSync(eq("HomeAwayConnection"), anyString(), anyString());
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("updates existing connection")
        void existing_updates() {
            HomeAwayConnection existing = new HomeAwayConnection();
            existing.setId(2L);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "at");
            body.put("expires_in", 3600);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("at")).thenReturn("enc-at");
            when(connectionRepository.save(any(HomeAwayConnection.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            HomeAwayConnection result = service.exchangeCodeForToken("auth-code", ORG_ID);

            assertThat(result.getId()).isEqualTo(2L);
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("enc-at");
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("on non-2xx: marks existing connection ERROR + rethrows")
        void non2xx_marksError() {
            HomeAwayConnection existing = new HomeAwayConnection();
            existing.setId(2L);
            when(connectionRepository.findByOrganizationId(ORG_ID))
                .thenReturn(Optional.of(existing));
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(HttpStatus.BAD_REQUEST));

            assertThatThrownBy(() -> service.exchangeCodeForToken("code", ORG_ID))
                .isInstanceOf(RuntimeException.class);

            verify(connectionRepository, atLeastOnce()).save(any(HomeAwayConnection.class));
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("on RestClientException: rethrows")
        void restClientException_rethrows() {
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getRedirectUri()).thenReturn("https://clenzy.fr/cb");
            when(config.getTokenUrl()).thenReturn("https://ha/token");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(new RestClientException("net down"));
            when(connectionRepository.findByOrganizationId(ORG_ID))
                .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.exchangeCodeForToken("code", ORG_ID))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== GET VALID ACCESS TOKEN — extended =====

    @Nested
    @DisplayName("getValidAccessToken — extended")
    class GetValidAccessTokenExtended {

        @Test
        @DisplayName("returns decrypted token when not near expiry")
        void notExpiring_returnsDecrypted() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            conn.setAccessTokenEncrypted("enc-at");
            when(connectionRepository.findByOrganizationId(ORG_ID))
                .thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-at")).thenReturn("plain-at");

            String token = service.getValidAccessToken(ORG_ID);

            assertThat(token).isEqualTo("plain-at");
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        @Test
        @DisplayName("auto-refreshes when near expiry")
        void nearExpiry_refreshes() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusMinutes(2));
            conn.setAccessTokenEncrypted("enc-old");
            conn.setRefreshTokenEncrypted("enc-rt");
            when(connectionRepository.findByOrganizationId(ORG_ID))
                .thenReturn(Optional.of(conn));
            when(encryptionService.decrypt("enc-rt")).thenReturn("plain-rt");
            when(config.getClientId()).thenReturn("cid");
            when(config.getClientSecret()).thenReturn("csec");
            when(config.getTokenUrl()).thenReturn("https://ha/token");

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "new-at");
            body.put("expires_in", 3600);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(body));
            when(encryptionService.encrypt("new-at")).thenReturn("enc-new-at");
            when(encryptionService.decrypt("enc-new-at")).thenReturn("plain-new-at");
            when(connectionRepository.save(any(HomeAwayConnection.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            String token = service.getValidAccessToken(ORG_ID);

            assertThat(token).isEqualTo("plain-new-at");
        }
    }

    // ===== GET CONNECTION STATUS =====

    @Nested
    @DisplayName("getConnectionStatus")
    class GetConnectionStatusTests {

        @Test
        @DisplayName("returns Optional from repository")
        void delegates() {
            HomeAwayConnection conn = new HomeAwayConnection();
            conn.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            Optional<HomeAwayConnection> result = service.getConnectionStatus(ORG_ID);

            assertThat(result).isPresent();
            assertThat(result.get().getStatus())
                .isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
        }

        @Test
        @DisplayName("returns empty when no connection")
        void noConnection_empty() {
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.getConnectionStatus(ORG_ID)).isEmpty();
        }
    }
}
