package com.clenzy.integration.quickbooks.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.oauth.OAuthStateService.StatePayload;
import com.clenzy.integration.quickbooks.config.QuickBooksOAuthProviderConfig;
import com.clenzy.integration.quickbooks.model.QuickBooksConnection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link QuickBooksOAuthService}.
 *
 * <p>Facade over {@link OAuthFlowEngine} / {@link OAuthStateService} /
 * {@link QuickBooksConnectionPersistence} with the QBO-specific realmId hook
 * (Intuit sends the company realmId as a callback parameter).</p>
 */
@ExtendWith(MockitoExtension.class)
class QuickBooksOAuthServiceTest {

    @Mock private OAuthFlowEngine flowEngine;
    @Mock private OAuthStateService stateService;
    @Mock private QuickBooksOAuthProviderConfig providerConfig;
    @Mock private QuickBooksConnectionPersistence persistence;

    private QuickBooksOAuthService service;

    private static final Long USER_ID = 13L;
    private static final Long ORG_ID = 14L;

    @BeforeEach
    void setUp() {
        service = new QuickBooksOAuthService(flowEngine, stateService, providerConfig, persistence);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("delegates to OAuthFlowEngine")
        void delegatesToEngine() {
            when(flowEngine.buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID))
                    .thenReturn("https://appcenter.intuit.com/connect/oauth2?state=abc");

            String url = service.getAuthorizationUrl(USER_ID, ORG_ID);

            assertThat(url).contains("intuit.com");
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
            when(stateService.validateAndConsume(QuickBooksOAuthProviderConfig.PROVIDER_KEY, "s"))
                    .thenReturn(Optional.of(payload));

            assertThat(service.validateAndConsumeState("s")).contains(payload);
        }

        @Test
        @DisplayName("returns empty when state is invalid or expired")
        void whenInvalid_thenEmpty() {
            when(stateService.validateAndConsume(QuickBooksOAuthProviderConfig.PROVIDER_KEY, "bad"))
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
            QuickBooksConnection conn = new QuickBooksConnection();
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "code", USER_ID, ORG_ID))
                    .thenReturn(conn);

            assertThat(service.exchangeCodeForToken("code", USER_ID, ORG_ID)).isSameAs(conn);
        }
    }

    // ===== SAVE REALM ID =====

    @Nested
    @DisplayName("saveRealmId")
    class SaveRealmId {

        @Test
        @DisplayName("updates realmId on existing connection and saves it")
        void whenConnectionExists_thenSaves() {
            QuickBooksConnection conn = new QuickBooksConnection();
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            service.saveRealmId(ORG_ID, "realm-42");

            ArgumentCaptor<QuickBooksConnection> captor = ArgumentCaptor.forClass(QuickBooksConnection.class);
            verify(persistence).save(captor.capture());
            assertThat(captor.getValue().getRealmId()).isEqualTo("realm-42");
        }

        @Test
        @DisplayName("does nothing when no connection exists")
        void whenNoConnection_thenDoesNothing() {
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            service.saveRealmId(ORG_ID, "realm-42");

            verify(persistence, never()).save(any());
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @Test
        @DisplayName("delegates to engine")
        void delegatesToEngine() {
            QuickBooksConnection conn = new QuickBooksConnection();
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
                    .thenReturn("plain-qbo-token");

            assertThat(service.getValidAccessToken(ORG_ID)).isEqualTo("plain-qbo-token");
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
                    .thenReturn(Optional.of(new QuickBooksConnection()));

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
            QuickBooksConnection conn = new QuickBooksConnection();
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
