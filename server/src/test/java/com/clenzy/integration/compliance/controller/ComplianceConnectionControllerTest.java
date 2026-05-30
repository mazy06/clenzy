package com.clenzy.integration.compliance.controller;

import com.clenzy.integration.compliance.dto.ComplianceConnectionRequest;
import com.clenzy.integration.compliance.dto.ComplianceConnectionStatusDto;
import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.service.ComplianceConnectionService;
import com.clenzy.integration.compliance.strategy.ComplianceConnectionTestStrategy;
import com.clenzy.integration.compliance.strategy.ComplianceConnectionTestStrategyRegistry;
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
class ComplianceConnectionControllerTest {

    @Mock private ComplianceConnectionService service;
    @Mock private ComplianceConnectionTestStrategyRegistry strategyRegistry;
    @Mock private TenantContext tenantContext;

    private ComplianceConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ComplianceConnectionController(service, strategyRegistry, tenantContext);
        jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("sub", "u-1").claim("user_id", 42L)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private ComplianceConnectionRequest req() {
        return new ComplianceConnectionRequest("https://chekin.test", "acct", "api-key-xx");
    }

    @Test
    void connect_strategyMissing_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.connect(ComplianceProviderType.CHEKIN, req(), jwt))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connect_testFails_400() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ComplianceConnectionTestStrategy s = mock(ComplianceConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(false);
        when(strategyRegistry.findFor(ComplianceProviderType.POLICE_MA)).thenReturn(Optional.of(s));

        ResponseEntity<?> response = controller.connect(ComplianceProviderType.POLICE_MA, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void connect_success_saves() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ComplianceConnectionTestStrategy s = mock(ComplianceConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ComplianceProviderType.ABSHER_KSA)).thenReturn(Optional.of(s));

        ComplianceConnection conn = new ComplianceConnection();
        conn.setProviderType(ComplianceProviderType.ABSHER_KSA);
        when(service.saveConnection(eq(1L), eq(42L), eq(ComplianceProviderType.ABSHER_KSA),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ComplianceProviderType.ABSHER_KSA, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(ComplianceProviderType.ABSHER_KSA),
                anyString(), any(), anyString());
    }

    @Test
    void connect_jwtNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ComplianceConnectionTestStrategy s = mock(ComplianceConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(s));
        ComplianceConnection conn = new ComplianceConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ComplianceProviderType.CHEKIN, req(), null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtStringUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt strJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "77")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ComplianceConnectionTestStrategy s = mock(ComplianceConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(s));
        ComplianceConnection conn = new ComplianceConnection();
        when(service.saveConnection(eq(1L), eq(77L), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ComplianceProviderType.CHEKIN, req(), strJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtBadStringUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt badJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "xyz")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ComplianceConnectionTestStrategy s = mock(ComplianceConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(s));
        ComplianceConnection conn = new ComplianceConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ComplianceProviderType.CHEKIN, req(), badJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_connected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ComplianceConnection conn = new ComplianceConnection();
        conn.setProviderType(ComplianceProviderType.CHEKIN);
        when(service.getConnection(1L, ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(conn));

        ResponseEntity<ComplianceConnectionStatusDto> response = controller.status(ComplianceProviderType.CHEKIN);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_notConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, ComplianceProviderType.POLICE_MA)).thenReturn(Optional.empty());

        ResponseEntity<ComplianceConnectionStatusDto> response = controller.status(ComplianceProviderType.POLICE_MA);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void disconnect_true() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, ComplianceProviderType.CHEKIN)).thenReturn(true);

        ResponseEntity<?> response = controller.disconnect(ComplianceProviderType.CHEKIN);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", true);
    }

    @Test
    void disconnect_false() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, ComplianceProviderType.POLICE_MA)).thenReturn(false);

        ResponseEntity<?> response = controller.disconnect(ComplianceProviderType.POLICE_MA);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", false);
    }
}
