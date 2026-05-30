package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.service.PennylaneOAuthService;
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
@DisplayName("PennylaneOAuthController")
class PennylaneOAuthControllerTest {

    private static final Long ORG_ID = 42L;
    private static final Long USER_ID = 7L;

    @Mock private PennylaneOAuthService oauthService;
    @Mock private TenantContext tenantContext;

    private PennylaneOAuthController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new PennylaneOAuthController(oauthService, tenantContext);
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
                    .thenReturn("https://app.pennylane.com/oauth/authorize?state=xyz");

            ResponseEntity<Map<String, String>> response = controller.connect(jwt);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "redirect")
                    .containsEntry("authorization_url", "https://app.pennylane.com/oauth/authorize?state=xyz");
        }
    }

    @Nested
    @DisplayName("callback")
    class Callback {

        @Test
        @DisplayName("when valid state + code then redirects to success and exchanges code")
        void whenValidStateAndCode_thenRedirectsToSuccess() {
            Map<String, Long> stateData = Map.of("userId", USER_ID, "orgId", ORG_ID);
            when(oauthService.validateAndConsumeState("state-abc"))
                    .thenReturn(Optional.of(stateData));

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
            Map<String, Long> stateData = Map.of("userId", USER_ID, "orgId", ORG_ID);
            when(oauthService.validateAndConsumeState("state"))
                    .thenReturn(Optional.of(stateData));
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
        @DisplayName("when ACTIVE connection then returns connected true with scopes and lastSyncAt")
        void whenActiveConnection_thenReturnsConnectedTrue() {
            PennylaneConnection conn = new PennylaneConnection();
            conn.setStatus(PennylaneConnection.Status.ACTIVE);
            conn.setScopes("read,write");
            conn.setConnectedAt(Instant.parse("2026-01-15T10:00:00Z"));
            conn.setLastSyncAt(Instant.parse("2026-02-20T14:30:00Z"));

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", true);
            assertThat(body).containsEntry("scopes", "read,write");
            assertThat(body).containsEntry("status", "ACTIVE");
            assertThat(body).containsKey("lastSyncAt");
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
        @DisplayName("when connection REVOKED then returns connected false with status")
        void whenConnectionRevoked_thenReturnsConnectedFalseWithStatus() {
            PennylaneConnection conn = new PennylaneConnection();
            conn.setStatus(PennylaneConnection.Status.REVOKED);
            conn.setErrorMessage("Revoked by user");

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(oauthService.getConnection(ORG_ID)).thenReturn(Optional.of(conn));

            ResponseEntity<Map<String, Object>> response = controller.status();

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body).containsEntry("connected", false);
            assertThat(body).containsEntry("status", "REVOKED");
            assertThat(body).containsEntry("errorMessage", "Revoked by user");
        }
    }
}
