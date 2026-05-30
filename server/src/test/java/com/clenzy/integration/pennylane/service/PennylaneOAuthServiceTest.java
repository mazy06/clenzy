package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.OAuthFlowEngine;
import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.oauth.OAuthStateService.StatePayload;
import com.clenzy.integration.pennylane.config.PennylaneOAuthProviderConfig;
import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import com.clenzy.repository.IntegrationPartnerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PennylaneOAuthService}.
 *
 * <p>The service is a thin facade over {@link OAuthFlowEngine} +
 * {@link OAuthStateService} + {@link PennylaneConnectionPersistence}, with
 * Pennylane-specific {@link IntegrationPartner} status synchronization.
 * Tests verify the delegation contract and the partner status side-effect.</p>
 */
@ExtendWith(MockitoExtension.class)
class PennylaneOAuthServiceTest {

    @Mock private OAuthFlowEngine flowEngine;
    @Mock private OAuthStateService stateService;
    @Mock private PennylaneOAuthProviderConfig providerConfig;
    @Mock private PennylaneConnectionPersistence persistence;
    @Mock private IntegrationPartnerRepository partnerRepository;

    private PennylaneOAuthService service;

    private static final Long USER_ID = 42L;
    private static final Long ORG_ID = 10L;

    @BeforeEach
    void setUp() {
        service = new PennylaneOAuthService(
                flowEngine, stateService, providerConfig, persistence, partnerRepository);
    }

    // ===== GET AUTHORIZATION URL =====

    @Nested
    @DisplayName("getAuthorizationUrl")
    class GetAuthorizationUrl {

        @Test
        @DisplayName("delegates to OAuthFlowEngine and returns URL")
        void delegatesToEngine() {
            when(flowEngine.buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID))
                    .thenReturn("https://app.pennylane.com/oauth/authorize?state=xyz");

            String url = service.getAuthorizationUrl(USER_ID, ORG_ID);

            assertThat(url).isEqualTo("https://app.pennylane.com/oauth/authorize?state=xyz");
            verify(flowEngine).buildAuthorizationUrl(providerConfig, USER_ID, ORG_ID);
        }
    }

    // ===== VALIDATE AND CONSUME STATE =====

    @Nested
    @DisplayName("validateAndConsumeState")
    class ValidateAndConsumeState {

        @Test
        @DisplayName("returns Map<userId, orgId> when state is valid")
        void whenValid_thenReturnsMap() {
            when(stateService.validateAndConsume(
                    PennylaneOAuthProviderConfig.PROVIDER_KEY, "valid-state"))
                    .thenReturn(Optional.of(new StatePayload(USER_ID, ORG_ID)));

            Optional<Map<String, Long>> result = service.validateAndConsumeState("valid-state");

            assertThat(result).isPresent();
            assertThat(result.get()).containsEntry("userId", USER_ID);
            assertThat(result.get()).containsEntry("orgId", ORG_ID);
        }

        @Test
        @DisplayName("returns empty when state is invalid or expired")
        void whenInvalid_thenReturnsEmpty() {
            when(stateService.validateAndConsume(
                    PennylaneOAuthProviderConfig.PROVIDER_KEY, "bad-state"))
                    .thenReturn(Optional.empty());

            assertThat(service.validateAndConsumeState("bad-state")).isEmpty();
        }
    }

    // ===== EXCHANGE CODE FOR TOKEN =====

    @Nested
    @DisplayName("exchangeCodeForToken")
    class ExchangeCodeForToken {

        @Test
        @DisplayName("delegates to engine and updates partner status to CONNECTED")
        void whenSuccess_thenUpdatesPartnerStatus() {
            PennylaneConnection saved = new PennylaneConnection();
            saved.setOrganizationId(ORG_ID);
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "auth-code", USER_ID, ORG_ID))
                    .thenReturn(saved);

            IntegrationPartner partner = new IntegrationPartner();
            partner.setStatus(IntegrationStatus.AVAILABLE);
            when(partnerRepository.findBySlugAndOrgId("pennylane", ORG_ID))
                    .thenReturn(Optional.of(partner));

            PennylaneConnection result = service.exchangeCodeForToken("auth-code", USER_ID, ORG_ID);

            assertThat(result).isSameAs(saved);
            ArgumentCaptor<IntegrationPartner> captor = ArgumentCaptor.forClass(IntegrationPartner.class);
            verify(partnerRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(IntegrationStatus.CONNECTED);
            assertThat(captor.getValue().getConnectedAt()).isNotNull();
        }

        @Test
        @DisplayName("does not call partnerRepository.save when partner does not exist")
        void whenNoPartner_thenSkipsStatusUpdate() {
            PennylaneConnection saved = new PennylaneConnection();
            when(flowEngine.exchangeCodeForToken(providerConfig, persistence, "code", USER_ID, ORG_ID))
                    .thenReturn(saved);
            when(partnerRepository.findBySlugAndOrgId("pennylane", ORG_ID))
                    .thenReturn(Optional.empty());

            service.exchangeCodeForToken("code", USER_ID, ORG_ID);

            verify(partnerRepository, never()).save(any());
        }
    }

    // ===== REFRESH TOKEN =====

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        @Test
        @DisplayName("delegates to engine and returns refreshed connection")
        void delegatesToEngine() {
            PennylaneConnection conn = new PennylaneConnection();
            when(flowEngine.refreshToken(providerConfig, persistence, ORG_ID)).thenReturn(conn);

            PennylaneConnection result = service.refreshToken(ORG_ID);

            assertThat(result).isSameAs(conn);
            verify(flowEngine).refreshToken(providerConfig, persistence, ORG_ID);
        }
    }

    // ===== REVOKE TOKEN =====

    @Nested
    @DisplayName("revokeToken")
    class RevokeToken {

        @Test
        @DisplayName("delegates to engine and updates partner status to DISCONNECTED")
        void delegatesAndDisconnects() {
            IntegrationPartner partner = new IntegrationPartner();
            partner.setStatus(IntegrationStatus.CONNECTED);
            when(partnerRepository.findBySlugAndOrgId("pennylane", ORG_ID))
                    .thenReturn(Optional.of(partner));

            service.revokeToken(ORG_ID);

            verify(flowEngine).revokeToken(providerConfig, persistence, ORG_ID);
            ArgumentCaptor<IntegrationPartner> captor = ArgumentCaptor.forClass(IntegrationPartner.class);
            verify(partnerRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(IntegrationStatus.DISCONNECTED);
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
        @DisplayName("returns true when an active connection exists")
        void whenActive_thenTrue() {
            when(persistence.findActiveByOrganizationId(ORG_ID))
                    .thenReturn(Optional.of(new PennylaneConnection()));

            assertThat(service.isConnected(ORG_ID)).isTrue();
        }

        @Test
        @DisplayName("returns false when no active connection exists")
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
            PennylaneConnection conn = new PennylaneConnection();
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            Optional<PennylaneConnection> result = service.getConnection(ORG_ID);

            assertThat(result).isPresent().containsSame(conn);
        }

        @Test
        @DisplayName("returns empty when no connection exists")
        void whenNoConnection_thenEmpty() {
            when(persistence.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.getConnection(ORG_ID)).isEmpty();
        }
    }
}
