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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
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
    }
}
