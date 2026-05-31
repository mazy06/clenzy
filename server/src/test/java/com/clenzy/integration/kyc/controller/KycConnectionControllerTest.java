package com.clenzy.integration.kyc.controller;

import com.clenzy.integration.kyc.dto.KycConnectionRequest;
import com.clenzy.integration.kyc.dto.KycConnectionStatusDto;
import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import com.clenzy.integration.kyc.service.KycConnectionService;
import com.clenzy.integration.kyc.strategy.KycConnectionTestStrategy;
import com.clenzy.integration.kyc.strategy.KycConnectionTestStrategyRegistry;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KycConnectionControllerTest {

    @Mock private KycConnectionService service;
    @Mock private KycConnectionTestStrategyRegistry strategyRegistry;
    @Mock private TenantContext tenantContext;

    private KycConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new KycConnectionController(service, strategyRegistry, tenantContext);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "u-1")
                .claim("user_id", 42L)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private KycConnectionRequest req() {
        return new KycConnectionRequest("https://sumsub.test", "acct", "api-key-xx");
    }

    @Test
    void connect_whenStrategyMissing_throwsIllegalState() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(strategyRegistry.findFor(KycProviderType.SUMSUB)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.connect(KycProviderType.SUMSUB, req(), jwt))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connect_whenTestFails_returns400() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(false);
        when(strategyRegistry.findFor(KycProviderType.SUMSUB)).thenReturn(Optional.of(strategy));

        ResponseEntity<?> response = controller.connect(KycProviderType.SUMSUB, req(), jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("error", "connection_failed");
    }

    @Test
    void connect_whenSuccess_savesAndReturnsStatus() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(KycProviderType.VERIFF)).thenReturn(Optional.of(strategy));

        KycConnection conn = new KycConnection();
        conn.setOrganizationId(1L);
        conn.setProviderType(KycProviderType.VERIFF);
        conn.setServerUrl("https://veriff.test");
        when(service.saveConnection(eq(1L), eq(42L), eq(KycProviderType.VERIFF),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(KycProviderType.VERIFF, req(), jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(KycProviderType.VERIFF),
                anyString(), any(), anyString());
    }

    @Test
    void connect_whenJwtUserIdIsString_parsesCorrectly() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt strJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "99")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(KycProviderType.ONFIDO)).thenReturn(Optional.of(strategy));

        KycConnection conn = new KycConnection();
        when(service.saveConnection(eq(1L), eq(99L), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(KycProviderType.ONFIDO, req(), strJwt);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_whenJwtNoUserId_returnsNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt noUserIdJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(KycProviderType.SUMSUB)).thenReturn(Optional.of(strategy));

        KycConnection conn = new KycConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(KycProviderType.SUMSUB, req(), noUserIdJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_whenJwtIsNull_userIdNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(KycProviderType.SUMSUB)).thenReturn(Optional.of(strategy));

        KycConnection conn = new KycConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(KycProviderType.SUMSUB, req(), null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_whenJwtUserIdInvalidString_returnsNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt badJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "not-a-number")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        KycConnectionTestStrategy strategy = mock(KycConnectionTestStrategy.class);
        when(strategy.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(KycProviderType.SUMSUB)).thenReturn(Optional.of(strategy));

        KycConnection conn = new KycConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(KycProviderType.SUMSUB, req(), badJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_whenConnected_returnsConnection() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        KycConnection conn = new KycConnection();
        conn.setProviderType(KycProviderType.SUMSUB);
        when(service.getConnection(1L, KycProviderType.SUMSUB)).thenReturn(Optional.of(conn));

        ResponseEntity<KycConnectionStatusDto> response = controller.status(KycProviderType.SUMSUB);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void status_whenNotConnected_returnsNotConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, KycProviderType.VERIFF)).thenReturn(Optional.empty());

        ResponseEntity<KycConnectionStatusDto> response = controller.status(KycProviderType.VERIFF);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void disconnect_whenSuccess_returnsTrue() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, KycProviderType.ONFIDO)).thenReturn(true);

        ResponseEntity<?> response = controller.disconnect(KycProviderType.ONFIDO);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", true);
        assertThat(body).containsEntry("provider", KycProviderType.ONFIDO);
    }

    @Test
    void disconnect_whenNotConnected_returnsFalse() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, KycProviderType.SUMSUB)).thenReturn(false);

        ResponseEntity<?> response = controller.disconnect(KycProviderType.SUMSUB);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", false);
    }
}
