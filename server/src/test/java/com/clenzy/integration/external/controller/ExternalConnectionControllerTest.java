package com.clenzy.integration.external.controller;

import com.clenzy.integration.external.dto.ExternalConnectionRequest;
import com.clenzy.integration.external.dto.ExternalConnectionStatusDto;
import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.integration.external.strategy.ConnectionTestStrategy;
import com.clenzy.integration.external.strategy.ConnectionTestStrategyRegistry;
import com.clenzy.service.signature.SignatureProviderType;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExternalConnectionControllerTest {

    @Mock private ExternalServiceConnectionService service;
    @Mock private ConnectionTestStrategyRegistry strategyRegistry;
    @Mock private TenantContext tenantContext;

    private ExternalConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ExternalConnectionController(service, strategyRegistry, tenantContext);
        jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("sub", "u-1").claim("user_id", 42L)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private ExternalConnectionRequest req() {
        return new ExternalConnectionRequest("https://yousign.test", "acct", "api-key-xx");
    }

    @Test
    void connect_unsupportedProviderPennylane_400() {
        ResponseEntity<?> response = controller.connect(SignatureProviderType.PENNYLANE, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("error", "unsupported_provider");
    }

    @Test
    void connect_unsupportedDocusign_400() {
        ResponseEntity<?> response = controller.connect(SignatureProviderType.DOCUSIGN, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void connect_unsupportedClenzyCustom_400() {
        ResponseEntity<?> response = controller.connect(SignatureProviderType.CLENZY_CUSTOM, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void connect_strategyMissing_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(strategyRegistry.findFor(SignatureProviderType.YOUSIGN)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.connect(SignatureProviderType.YOUSIGN, req(), jwt))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connect_testFails_400() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(false);
        when(strategyRegistry.findFor(SignatureProviderType.UNIVERSIGN)).thenReturn(Optional.of(s));

        ResponseEntity<?> response = controller.connect(SignatureProviderType.UNIVERSIGN, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("error", "connection_failed");
    }

    @Test
    void connect_success() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(SignatureProviderType.DOCAPOSTE)).thenReturn(Optional.of(s));

        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setProviderType(SignatureProviderType.DOCAPOSTE);
        when(service.saveConnection(eq(1L), eq(42L), eq(SignatureProviderType.DOCAPOSTE),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(SignatureProviderType.DOCAPOSTE, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(SignatureProviderType.DOCAPOSTE),
                anyString(), any(), anyString());
    }

    @Test
    void connect_odooSuccess() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(SignatureProviderType.ODOO)).thenReturn(Optional.of(s));

        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setProviderType(SignatureProviderType.ODOO);
        when(service.saveConnection(eq(1L), eq(42L), eq(SignatureProviderType.ODOO),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(SignatureProviderType.ODOO, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(SignatureProviderType.YOUSIGN)).thenReturn(Optional.of(s));
        ExternalServiceConnection conn = new ExternalServiceConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(SignatureProviderType.YOUSIGN, req(), null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtStringUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt strJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "88")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(SignatureProviderType.YOUSIGN)).thenReturn(Optional.of(s));
        ExternalServiceConnection conn = new ExternalServiceConnection();
        when(service.saveConnection(eq(1L), eq(88L), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(SignatureProviderType.YOUSIGN, req(), strJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtBadUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt badJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "abc")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ConnectionTestStrategy s = mock(ConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(SignatureProviderType.YOUSIGN)).thenReturn(Optional.of(s));
        ExternalServiceConnection conn = new ExternalServiceConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(SignatureProviderType.YOUSIGN, req(), badJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_connected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setProviderType(SignatureProviderType.YOUSIGN);
        when(service.getConnection(1L, SignatureProviderType.YOUSIGN)).thenReturn(Optional.of(conn));

        ResponseEntity<ExternalConnectionStatusDto> response = controller.status(SignatureProviderType.YOUSIGN);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_notConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, SignatureProviderType.DOCAPOSTE)).thenReturn(Optional.empty());

        ResponseEntity<ExternalConnectionStatusDto> response = controller.status(SignatureProviderType.DOCAPOSTE);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void disconnect_true() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, SignatureProviderType.YOUSIGN)).thenReturn(true);

        ResponseEntity<?> response = controller.disconnect(SignatureProviderType.YOUSIGN);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", true);
    }

    @Test
    void disconnect_false() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, SignatureProviderType.DOCAPOSTE)).thenReturn(false);

        ResponseEntity<?> response = controller.disconnect(SignatureProviderType.DOCAPOSTE);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", false);
    }
}
