package com.clenzy.integration.oauth;

import com.clenzy.service.TokenEncryptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthFlowEngineTest {

    @Mock private OAuthStateService stateService;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private RestTemplate restTemplate;
    @Mock private OAuthProviderConfig providerConfig;
    @Mock private OAuthConnectionPersistence<TestConnection> persistence;

    private OAuthFlowEngine engine;

    @BeforeEach
    void setUp() {
        engine = new OAuthFlowEngine(stateService, encryptionService);
        // Replace inner restTemplate with mocked one
        ReflectionTestUtils.setField(engine, "restTemplate", restTemplate);

        lenient().when(providerConfig.getProviderKey()).thenReturn("test");
        lenient().when(providerConfig.getClientId()).thenReturn("client-id");
        lenient().when(providerConfig.getClientSecret()).thenReturn("client-secret");
        lenient().when(providerConfig.getRedirectUri()).thenReturn("http://localhost/callback");
        lenient().when(providerConfig.getAuthorizationUrl()).thenReturn("https://provider.com/auth");
        lenient().when(providerConfig.getTokenUrl()).thenReturn("https://provider.com/token");
        lenient().when(providerConfig.getRevokeUrl()).thenReturn("https://provider.com/revoke");
        lenient().when(providerConfig.getScopes()).thenReturn("read write");
        lenient().when(providerConfig.getRefreshTokenValidityDays()).thenReturn(90);
        lenient().when(providerConfig.useHttpBasicAuth()).thenReturn(false);
    }

    /** Simple stub OAuth connection. */
    static class TestConnection implements OAuthConnectionLike {
        Long orgId, userId;
        String accessToken, refreshToken, scopes, errorMessage;
        Instant tokenExpiresAt, refreshTokenExpiresAt, connectedAt;
        OAuthConnectionStatus status;

        @Override public Long getOrganizationId() { return orgId; }
        @Override public void setOrganizationId(Long o) { orgId = o; }
        @Override public Long getUserId() { return userId; }
        @Override public void setUserId(Long u) { userId = u; }
        @Override public String getAccessTokenEncrypted() { return accessToken; }
        @Override public void setAccessTokenEncrypted(String e) { accessToken = e; }
        @Override public String getRefreshTokenEncrypted() { return refreshToken; }
        @Override public void setRefreshTokenEncrypted(String e) { refreshToken = e; }
        @Override public Instant getTokenExpiresAt() { return tokenExpiresAt; }
        @Override public void setTokenExpiresAt(Instant a) { tokenExpiresAt = a; }
        @Override public Instant getRefreshTokenExpiresAt() { return refreshTokenExpiresAt; }
        @Override public void setRefreshTokenExpiresAt(Instant a) { refreshTokenExpiresAt = a; }
        @Override public String getScopes() { return scopes; }
        @Override public void setScopes(String s) { scopes = s; }
        @Override public OAuthConnectionStatus getOAuthStatus() { return status; }
        @Override public void setOAuthStatus(OAuthConnectionStatus s) { status = s; }
        @Override public String getErrorMessage() { return errorMessage; }
        @Override public void setErrorMessage(String m) { errorMessage = m; }
        @Override public Instant getConnectedAt() { return connectedAt; }
        @Override public void setConnectedAt(Instant a) { connectedAt = a; }
    }

    @Nested
    @DisplayName("buildAuthorizationUrl")
    class AuthUrl {

        @Test
        void whenCalled_thenIncludesAllParams() {
            when(stateService.generate("test", 1L, 100L)).thenReturn("state-uuid");

            String url = engine.buildAuthorizationUrl(providerConfig, 1L, 100L);

            assertThat(url).contains("client_id=client-id");
            assertThat(url).contains("redirect_uri=http");
            assertThat(url).contains("response_type=code");
            assertThat(url).contains("scope=read");
            assertThat(url).contains("state=state-uuid");
        }
    }

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCode {

        @Test
        @SuppressWarnings("unchecked")
        void whenSucceeds_thenPersistsConnection() {
            Map<String, Object> tokenResponse = new HashMap<>();
            tokenResponse.put("access_token", "at-1");
            tokenResponse.put("refresh_token", "rt-1");
            tokenResponse.put("expires_in", 3600);
            tokenResponse.put("scope", "read");
            tokenResponse.put("token_type", "Bearer");

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenResponse));
            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.empty());
            when(persistence.newConnection()).thenReturn(new TestConnection());
            when(persistence.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(encryptionService.encrypt("at-1")).thenReturn("encrypted-at");
            when(encryptionService.encrypt("rt-1")).thenReturn("encrypted-rt");

            TestConnection result = engine.exchangeCodeForToken(providerConfig, persistence, "code-123", 1L, 100L);

            assertThat(result.getAccessTokenEncrypted()).isEqualTo("encrypted-at");
            assertThat(result.getRefreshTokenEncrypted()).isEqualTo("encrypted-rt");
            assertThat(result.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.ACTIVE);
            assertThat(result.getOrganizationId()).isEqualTo(100L);
            assertThat(result.getUserId()).isEqualTo(1L);
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenResponseHasNoAccessToken_thenThrows() {
            Map<String, Object> tokenResponse = new HashMap<>();
            tokenResponse.put("refresh_token", "rt");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenResponse));

            assertThatThrownBy(() -> engine.exchangeCodeForToken(providerConfig, persistence, "code", 1L, 100L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("access_token");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenExistingConnection_thenReuses() {
            TestConnection existing = new TestConnection();
            existing.setConnectedAt(Instant.now().minusSeconds(60));

            Map<String, Object> tokenResponse = Map.of(
                    "access_token", "at-2", "expires_in", 3600
            );
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenResponse));
            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(persistence.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(encryptionService.encrypt("at-2")).thenReturn("encrypted-at-2");

            TestConnection result = engine.exchangeCodeForToken(providerConfig, persistence, "code", 1L, 100L);

            assertThat(result).isSameAs(existing);
            assertThat(result.getAccessTokenEncrypted()).isEqualTo("encrypted-at-2");
        }
    }

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @Test
        @SuppressWarnings("unchecked")
        void whenSucceeds_thenUpdatesConnection() {
            TestConnection existing = new TestConnection();
            existing.setRefreshTokenEncrypted("encrypted-rt-old");
            existing.setOAuthStatus(OAuthConnectionStatus.ACTIVE);

            Map<String, Object> tokenResponse = Map.of("access_token", "new-at", "expires_in", 3600);

            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-rt-old")).thenReturn("rt-old");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenResponse));
            when(persistence.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(encryptionService.encrypt("new-at")).thenReturn("encrypted-new-at");

            TestConnection result = engine.refreshToken(providerConfig, persistence, 100L);

            assertThat(result.getAccessTokenEncrypted()).isEqualTo("encrypted-new-at");
            assertThat(result.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.ACTIVE);
        }

        @Test
        void whenNoConnection_thenThrows() {
            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> engine.refreshToken(providerConfig, persistence, 100L))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenRefreshFails_thenMarksError() {
            TestConnection existing = new TestConnection();
            existing.setRefreshTokenEncrypted("encrypted-rt");
            existing.setOAuthStatus(OAuthConnectionStatus.ACTIVE);

            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-rt")).thenReturn("rt");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenThrow(new RuntimeException("Refresh failed"));
            when(persistence.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatThrownBy(() -> engine.refreshToken(providerConfig, persistence, 100L))
                    .isInstanceOf(RuntimeException.class);
            assertThat(existing.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.ERROR);
            assertThat(existing.getErrorMessage()).contains("Refresh failed");
        }
    }

    @Nested
    @DisplayName("revokeToken")
    class RevokeToken {

        @Test
        void whenConnectionExists_thenMarksRevoked() {
            TestConnection existing = new TestConnection();
            existing.setAccessTokenEncrypted("encrypted-at");
            existing.setOAuthStatus(OAuthConnectionStatus.ACTIVE);

            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-at")).thenReturn("at");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Void.class)))
                    .thenReturn(ResponseEntity.noContent().build());

            engine.revokeToken(providerConfig, persistence, 100L);

            assertThat(existing.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.REVOKED);
            assertThat(existing.getAccessTokenEncrypted()).isNull();
            assertThat(existing.getRefreshTokenEncrypted()).isNull();
            verify(persistence).save(existing);
        }

        @Test
        void whenNoConnection_thenThrows() {
            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> engine.revokeToken(providerConfig, persistence, 100L))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenRevokeApiFails_thenStillMarksRevokedLocally() {
            TestConnection existing = new TestConnection();
            existing.setAccessTokenEncrypted("encrypted-at");
            existing.setOAuthStatus(OAuthConnectionStatus.ACTIVE);

            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-at")).thenReturn("at");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Void.class)))
                    .thenThrow(new RuntimeException("Provider down"));

            engine.revokeToken(providerConfig, persistence, 100L);

            assertThat(existing.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.REVOKED);
        }

        @Test
        void whenRevokeUrlNull_thenSkipsApiCallButMarksRevoked() {
            TestConnection existing = new TestConnection();
            existing.setAccessTokenEncrypted("encrypted-at");
            existing.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
            when(providerConfig.getRevokeUrl()).thenReturn(null);
            when(persistence.findByOrganizationId(100L)).thenReturn(Optional.of(existing));

            engine.revokeToken(providerConfig, persistence, 100L);

            assertThat(existing.getOAuthStatus()).isEqualTo(OAuthConnectionStatus.REVOKED);
        }
    }

    @Nested
    @DisplayName("getValidAccessToken")
    class GetValidAccessToken {

        @Test
        void whenTokenNotExpiring_thenReturnsExisting() {
            TestConnection existing = new TestConnection();
            existing.setAccessTokenEncrypted("encrypted-at");
            existing.setTokenExpiresAt(Instant.now().plusSeconds(3600)); // Not expiring
            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-at")).thenReturn("at-clear");

            String token = engine.getValidAccessToken(providerConfig, persistence, 100L);
            assertThat(token).isEqualTo("at-clear");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenTokenExpiring_thenRefreshes() {
            TestConnection existing = new TestConnection();
            existing.setAccessTokenEncrypted("encrypted-at-old");
            existing.setRefreshTokenEncrypted("encrypted-rt");
            existing.setTokenExpiresAt(Instant.now().minusSeconds(60)); // Already expired

            Map<String, Object> tokenResponse = Map.of("access_token", "new-at", "expires_in", 3600);

            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.of(existing));
            when(encryptionService.decrypt("encrypted-rt")).thenReturn("rt");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenResponse));
            when(persistence.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(encryptionService.encrypt("new-at")).thenReturn("encrypted-new-at");
            when(encryptionService.decrypt("encrypted-new-at")).thenReturn("new-at");

            String token = engine.getValidAccessToken(providerConfig, persistence, 100L);
            assertThat(token).isEqualTo("new-at");
        }

        @Test
        void whenNoActiveConnection_thenThrows() {
            when(persistence.findActiveByOrganizationId(100L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> engine.getValidAccessToken(providerConfig, persistence, 100L))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
