package com.clenzy.integration.sage.controller;

import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.sage.model.SageConnection;
import com.clenzy.integration.sage.service.SageOAuthService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SageOAuthController")
class SageOAuthControllerTest {

    private static final Long ORG_ID = 42L;
    private static final Long USER_ID = 7L;

    @Mock private SageOAuthService oauthService;
    @Mock private TenantContext tenantContext;

    private SageOAuthController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new SageOAuthController(oauthService, tenantContext);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("userId", USER_ID)
                .claim("sub", "kc-user-uuid")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("connect")
    class Connect {

        @Test
        @DisplayName("when already connected then returns already_connected status")
        void whenAlreadyConnected_thenReturnsAlreadyConnectedStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);

            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "already_connected");
            verify(oauthService, never()).getAuthorizationUrl(anyLong(), anyLong());
        }

        @Test
        @DisplayName("when not connected then returns authorization URL")
        void whenNotConnected_thenReturnsAuthorizationUrl() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.isConnected(ORG_ID)).thenReturn(false);
            when(oauthService.getAuthorizationUrl(USER_ID, ORG_ID))
                    .thenReturn("https://www.sageone.com/oauth2/auth/central?state=xyz");

            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "redirect")
                    .containsEntry("authorization_url", "https://www.sageone.com/oauth2/auth/central?state=xyz");
        }
    }

    @Nested
    @DisplayName("callback")
    class Callback {

        @Test
        @DisplayName("when valid state + code then redirects to success and exchanges code")
        void whenValidStateAndCode_thenRedirectsToSuccess() {
            OAuthStateService.StatePayload payload = new OAuthStateService.StatePayload(USER_ID, ORG_ID);
            when(oauthService.validateAndConsumeState("state-abc"))
                    .thenReturn(Optional.of(payload));

            ResponseEntity<String> response = controller.callback("code-xyz", "state-abc");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
            assertThat(response.getHeaders().getFirst("Location"))
                    .isEqualTo("/settings?tab=integrations&status=success");
            verify(oauthService).exchangeCodeForToken("code-xyz", USER_ID, ORG_ID);
        }

        @Test
        @DisplayName("when invalid state then redirects to error with invalid_state reason")
        void whenInvalidState_thenRedirectsToErrorWithInvalidState() {
            when(oauthService.validateAndConsumeState("bad-state")).thenReturn(Optional.empty());

            ResponseEntity<String> response = controller.callback("code", "bad-state");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
            assertThat(response.getHeaders().getFirst("Location"))
                    .isEqualTo("/settings?tab=integrations&status=error&reason=invalid_state");
            verify(oauthService, never()).exchangeCodeForToken(anyString(), anyLong(), anyLong());
        }

        @Test
        @DisplayName("when token exchange throws then redirects to error with token_exchange reason")
        void whenTokenExchangeFails_thenRedirectsToErrorWithTokenExchange() {
            OAuthStateService.StatePayload payload = new OAuthStateService.StatePayload(USER_ID, ORG_ID);
            when(oauthService.validateAndConsumeState("state"))
                    .thenReturn(Optional.of(payload));
            when(oauthService.exchangeCodeForToken("bad-code", USER_ID, ORG_ID))
                    .thenThrow(new RuntimeException("Token exchange failed"));

            ResponseEntity<String> response = controller.callback("bad-code", "state");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
            assertThat(response.getHeaders().getFirst("Location"))
                    .isEqualTo("/settings?tab=integrations&status=error&reason=token_exchange");
        }
    }

    @Nested
    @DisplayName("disconnect")
    class Disconnect {

        @Test
        @DisplayName("when successful then returns disconnected status")
        void whenSuccessful_thenReturnsDisconnected() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            doNothing().when(oauthService).revokeToken(ORG_ID);

            ResponseEntity<Map<String, String>> response = controller.disconnect();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "disconnected");
            verify(oauthService).revokeToken(ORG_ID);
        }

        @Test
        @DisplayName("when revoke fails then returns 500 with error status")
        void whenRevokeFails_thenReturnsInternalServerError() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            doThrow(new RuntimeException("Revoke failed")).when(oauthService).revokeToken(ORG_ID);

            ResponseEntity<Map<String, String>> response = controller.disconnect();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).containsEntry("status", "error");
        }
    }

    @Nested
    @DisplayName("status")
    class Status {

        @Test
        @DisplayName("when ACTIVE connection then returns connected true with business info")
        void whenActiveConnection_thenReturnsConnectedTrue() {
            SageConnection conn = new SageConnection();
            conn.setStatus(SageConnection.Status.ACTIVE);
            conn.setBusinessId("biz-9999");
            conn.setBusinessName("Acme SARL");
            conn.setScopes("full_access");
            conn.setConnectedAt(Instant.parse("2026-01-15T10:00:00Z"));

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", true);
            assertThat(body).containsEntry("businessId", "biz-9999");
            assertThat(body).containsEntry("businessName", "Acme SARL");
            assertThat(body).containsEntry("status", "ACTIVE");
        }

        @Test
        @DisplayName("when no connection then returns connected false")
        void whenNoConnection_thenReturnsConnectedFalse() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> response = controller.status();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("connected", false);
        }

        @Test
        @DisplayName("when connection ERROR then returns connected false with status and errorMessage")
        void whenConnectionError_thenReturnsConnectedFalseWithStatus() {
            SageConnection conn = new SageConnection();
            conn.setStatus(SageConnection.Status.ERROR);
            conn.setErrorMessage("Unexpected error");

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", false);
            assertThat(body).containsEntry("status", "ERROR");
            assertThat(body).containsEntry("errorMessage", "Unexpected error");
        }
    }
}
