package com.clenzy.integration.xero.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.oauth.OAuthStateService.StatePayload;
import com.clenzy.integration.xero.config.XeroOAuthProviderConfig;
import com.clenzy.integration.xero.model.XeroConnection;
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
 * Unit tests for {@link XeroOAuthService}.
 *
 * <p>Facade over {@link OAuthFlowEngine} / {@link OAuthStateService} /
 * {@link XeroConnectionPersistence} with a Xero-specific tenant-save hook.</p>
 */
@ExtendWith(MockitoExtension.class)
class XeroOAuthServiceTest {

    @Mock private OAuthFlowEngine flowEngine;
    @Mock private OAuthStateService stateService;
    @Mock private XeroOAuthProviderConfig providerConfig;
    @Mock private XeroConnectionPersistence persistence;

    private XeroOAuthService service;

    private static final Long USER_ID = 7L;
    private static final Long ORG_ID = 11L;

    @BeforeEach
    void setUp() {
        service = new XeroOAuthService(flowEngine, stateService, providerConfig, persistence);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("delegates to OAuthFlowEngine and returns URL")
        void delegatesToEngine() {
            when(flowEngine.buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID))
                    .thenReturn("https://login.xero.com/identity/connect/authorize?state=abc");

            String url = service.getAuthorizationUrl(USER_ID, ORG_ID);

            assertThat(url).contains("xero.com");
            verify(flowEngine).buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID);
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    @DisplayName("validateAndConsumeState")
    class ValidateAndConsumeState {

        @Test
        @DisplayName("returns StatePayload when state is valid")
        void whenValid_thenReturnsPayload() {
            StatePayload payload = new StatePayload(USER_ID, ORG_ID);
            when(stateService.validateAndConsume(XeroOAuthProviderConfig.PROVIDER_KEY, "s"))
                    .thenReturn(Optional.of(payload));

            assertThat(service.validateAndConsumeState("s")).contains(payload);
        }

        @Test
        @DisplayName("returns empty when state is invalid")
        void whenInvalid_thenEmpty() {
            when(stateService.validateAndConsume(XeroOAuthProviderConfig.PROVIDER_KEY, "bad"))
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
            XeroConnection conn = new XeroConnection();
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "code", USER_ID, ORG_ID))
                    .thenReturn(conn);

            assertThat(service.exchangeCodeForToken("code", USER_ID, ORG_ID)).isSameAs(conn);
        }
    }

    // ===== SAVE TENANT =====

    @Nested
    @DisplayName("saveTenant")
    class SaveTenant {

        @Test
        @DisplayName("updates tenant id+name on existing connection and saves it")
        void whenConnectionExists_thenSavesTenant() {
            XeroConnection conn = new XeroConnection();
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            service.saveTenant(ORG_ID, "tenant-xyz", "Acme Ltd");

            ArgumentCaptor<XeroConnection> captor = ArgumentCaptor.forClass(XeroConnection.class);
            verify(persistence).save(captor.capture());
            assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-xyz");
            assertThat(captor.getValue().getTenantName()).isEqualTo("Acme Ltd");
        }

        @Test
        @DisplayName("does nothing when no connection exists")
        void whenNoConnection_thenDoesNothing() {
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            service.saveTenant(ORG_ID, "tenant-xyz", "Acme Ltd");

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
            XeroConnection conn = new XeroConnection();
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
                    .thenReturn("access-xyz");

            assertThat(service.getValidAccessToken(ORG_ID)).isEqualTo("access-xyz");
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
                    .thenReturn(Optional.of(new XeroConnection()));

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
            XeroConnection conn = new XeroConnection();
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
