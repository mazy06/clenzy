package com.clenzy.integration.docusign.service;

import com.clenzy.integration.docusign.config.DocuSignOAuthProviderConfig;
import com.clenzy.integration.docusign.model.DocuSignConnection;
import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.oauth.OAuthStateService.StatePayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DocuSignOAuthService}.
 *
 * <p>Thin facade over {@link OAuthFlowEngine} / {@link OAuthStateService} /
 * {@link DocuSignConnectionPersistence}. Has no provider-specific post-callback
 * hook yet (the userinfo / accountId fetch is a TODO).</p>
 */
@ExtendWith(MockitoExtension.class)
class DocuSignOAuthServiceTest {

    @Mock private OAuthFlowEngine flowEngine;
    @Mock private OAuthStateService stateService;
    @Mock private DocuSignOAuthProviderConfig providerConfig;
    @Mock private DocuSignConnectionPersistence persistence;

    private DocuSignOAuthService service;

    private static final Long USER_ID = 21L;
    private static final Long ORG_ID = 22L;

    @BeforeEach
    void setUp() {
        service = new DocuSignOAuthService(flowEngine, stateService, providerConfig, persistence);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("delegates to OAuthFlowEngine")
        void delegatesToEngine() {
            when(flowEngine.buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID))
                    .thenReturn("https://account.docusign.com/oauth/auth?state=xyz");

            String url = service.getAuthorizationUrl(USER_ID, ORG_ID);

            assertThat(url).contains("docusign.com");
            verify(flowEngine).buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID);
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    @DisplayName("validateAndConsumeState")
    class ValidateAndConsumeState {

        @Test
        @DisplayName("returns payload when state is valid")
        void whenValid_thenPresent() {
            StatePayload payload = new StatePayload(USER_ID, ORG_ID);
            when(stateService.validateAndConsume(DocuSignOAuthProviderConfig.PROVIDER_KEY, "valid"))
                    .thenReturn(Optional.of(payload));

            assertThat(service.validateAndConsumeState("valid")).contains(payload);
        }

        @Test
        @DisplayName("returns empty when state is invalid or expired")
        void whenInvalid_thenEmpty() {
            when(stateService.validateAndConsume(DocuSignOAuthProviderConfig.PROVIDER_KEY, "bad"))
                    .thenReturn(Optional.empty());

            assertThat(service.validateAndConsumeState("bad")).isEmpty();
        }
    }

    // ===== EXCHANGE CODE FOR TOKEN =====

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCodeForToken {

        @Test
        @DisplayName("delegates to engine and returns connection")
        void delegatesToEngine() {
            DocuSignConnection conn = new DocuSignConnection();
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "code", USER_ID, ORG_ID))
                    .thenReturn(conn);

            assertThat(service.exchangeCodeForToken("code", USER_ID, ORG_ID)).isSameAs(conn);
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @Test
        @DisplayName("delegates to engine")
        void delegatesToEngine() {
            DocuSignConnection conn = new DocuSignConnection();
            when(flowEngine.refreshToken(providerConfig, persistence, ORG_ID)).thenReturn(conn);

            assertThat(service.refreshToken(ORG_ID)).isSameAs(conn);
        }
    }

    // ===== REVOKE TOKEN =====

    @Nested
    @DisplayName("revokeToken")
    class RevokeToken {

        @Test
        @DisplayName("delegates to engine")
        void delegatesToEngine() {
            service.revokeToken(ORG_ID);

            verify(flowEngine).revokeToken(providerConfig, persistence, ORG_ID);
        }
    }

    // ===== GET VALID ACCESS TOKEN =====

    @Nested
    @DisplayName("getValidAccessToken")
    class GetValidAccessToken {

        @Test
        @DisplayName("delegates to engine and returns access token")
        void delegatesToEngine() {
            when(flowEngine.getValidAccessToken(providerConfig, persistence, ORG_ID))
                    .thenReturn("ds-token");

            assertThat(service.getValidAccessToken(ORG_ID)).isEqualTo("ds-token");
        }
    }

    // ===== IS CONNECTED =====

    @Nested
    @DisplayName("isConnected")
    class IsConnected {

        @Test
        @DisplayName("returns true when active connection exists")
        void whenActive_thenTrue() {
            when(persistence.findActiveByOrganizationId(ORG_ID))
                    .thenReturn(Optional.of(new DocuSignConnection()));

            assertThat(service.isConnected(ORG_ID)).isTrue();
        }

        @Test
        @DisplayName("returns false when no active connection")
        void whenNoActive_thenFalse() {
            when(persistence.findActiveByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.isConnected(ORG_ID)).isFalse();
        }
    }

    // ===== GET CONNECTION =====

    @Nested
    @DisplayName("getConnection")
    class GetConnection {

        @Test
        @DisplayName("delegates to persistence findByOrganizationId")
        void delegatesToPersistence() {
            DocuSignConnection conn = new DocuSignConnection();
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            assertThat(service.getConnection(ORG_ID)).contains(conn);
        }

        @Test
        @DisplayName("returns empty when no connection exists")
        void whenNoConnection_thenEmpty() {
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.getConnection(ORG_ID)).isEmpty();
        }
    }
}
