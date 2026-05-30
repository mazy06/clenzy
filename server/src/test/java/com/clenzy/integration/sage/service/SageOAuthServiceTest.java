package com.clenzy.integration.sage.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.oauth.OAuthStateService.StatePayload;
import com.clenzy.integration.sage.config.SageOAuthProviderConfig;
import com.clenzy.integration.sage.model.SageConnection;
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
 * Unit tests for {@link SageOAuthService}.
 *
 * <p>Facade over {@link OAuthFlowEngine} / {@link OAuthStateService} /
 * {@link SageConnectionPersistence} with a Sage-specific business-save hook.</p>
 */
@ExtendWith(MockitoExtension.class)
class SageOAuthServiceTest {

    @Mock private OAuthFlowEngine flowEngine;
    @Mock private OAuthStateService stateService;
    @Mock private SageOAuthProviderConfig providerConfig;
    @Mock private SageConnectionPersistence persistence;

    private SageOAuthService service;

    private static final Long USER_ID = 5L;
    private static final Long ORG_ID = 12L;

    @BeforeEach
    void setUp() {
        service = new SageOAuthService(flowEngine, stateService, providerConfig, persistence);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("delegates to OAuthFlowEngine")
        void delegatesToEngine() {
            when(flowEngine.buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID))
                    .thenReturn("https://www.sageone.com/oauth2/auth/central?state=abc");

            String url = service.getAuthorizationUrl(USER_ID, ORG_ID);

            assertThat(url).contains("sageone.com");
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
            when(stateService.validateAndConsume(SageOAuthProviderConfig.PROVIDER_KEY, "s"))
                    .thenReturn(Optional.of(payload));

            assertThat(service.validateAndConsumeState("s")).contains(payload);
        }

        @Test
        @DisplayName("returns empty when state is invalid")
        void whenInvalid_thenEmpty() {
            when(stateService.validateAndConsume(SageOAuthProviderConfig.PROVIDER_KEY, "bad"))
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
            SageConnection conn = new SageConnection();
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "code", USER_ID, ORG_ID))
                    .thenReturn(conn);

            assertThat(service.exchangeCodeForToken("code", USER_ID, ORG_ID)).isSameAs(conn);
        }
    }

    // ===== SAVE BUSINESS =====

    @Nested
    @DisplayName("saveBusiness")
    class SaveBusiness {

        @Test
        @DisplayName("updates business id+name on existing connection and saves it")
        void whenConnectionExists_thenSaves() {
            SageConnection conn = new SageConnection();
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            service.saveBusiness(ORG_ID, "biz-1", "Acme Books");

            ArgumentCaptor<SageConnection> captor = ArgumentCaptor.forClass(SageConnection.class);
            verify(persistence).save(captor.capture());
            assertThat(captor.getValue().getBusinessId()).isEqualTo("biz-1");
            assertThat(captor.getValue().getBusinessName()).isEqualTo("Acme Books");
        }

        @Test
        @DisplayName("does nothing when no connection exists")
        void whenNoConnection_thenDoesNothing() {
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            service.saveBusiness(ORG_ID, "biz-1", "Acme Books");

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
            SageConnection conn = new SageConnection();
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
                    .thenReturn("plain-token");

            assertThat(service.getValidAccessToken(ORG_ID)).isEqualTo("plain-token");
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
                    .thenReturn(Optional.of(new SageConnection()));

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
            SageConnection conn = new SageConnection();
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
