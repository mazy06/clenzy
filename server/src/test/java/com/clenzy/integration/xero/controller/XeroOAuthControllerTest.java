package com.clenzy.integration.xero.controller;

import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.xero.model.XeroConnection;
import com.clenzy.integration.xero.service.XeroOAuthService;
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
@DisplayName("XeroOAuthController")
class XeroOAuthControllerTest {

    private static final Long ORG_ID = 42L;
    private static final Long USER_ID = 7L;

    @Mock private XeroOAuthService oauthService;
    @Mock private TenantContext tenantContext;

    private XeroOAuthController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new XeroOAuthController(oauthService, tenantContext);
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
                    .thenReturn("https://login.xero.com/identity/connect/authorize?state=xyz");

            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "redirect")
                    .containsEntry("authorization_url", "https://login.xero.com/identity/connect/authorize?state=xyz");
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
        @DisplayName("when ACTIVE connection then returns connected true with tenant info")
        void whenActiveConnection_thenReturnsConnectedTrue() {
            XeroConnection conn = new XeroConnection();
            conn.setStatus(XeroConnection.Status.ACTIVE);
            conn.setTenantId("tenant-9999");
            conn.setTenantName("Acme Corp");
            conn.setScopes("accounting.transactions");
            conn.setConnectedAt(Instant.parse("2026-01-15T10:00:00Z"));

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", true);
            assertThat(body).containsEntry("tenantId", "tenant-9999");
            assertThat(body).containsEntry("tenantName", "Acme Corp");
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
        @DisplayName("when connection EXPIRED then returns connected false with status")
        void whenConnectionExpired_thenReturnsConnectedFalseWithStatus() {
            XeroConnection conn = new XeroConnection();
            conn.setStatus(XeroConnection.Status.EXPIRED);
            conn.setErrorMessage("Token expired");

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", false);
            assertThat(body).containsEntry("status", "EXPIRED");
            assertThat(body).containsEntry("errorMessage", "Token expired");
        }
    }
}
