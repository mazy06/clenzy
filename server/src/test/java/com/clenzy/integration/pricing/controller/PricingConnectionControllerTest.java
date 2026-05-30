package com.clenzy.integration.pricing.controller;

import com.clenzy.integration.pricing.dto.PricingConnectionRequest;
import com.clenzy.integration.pricing.dto.PricingConnectionStatusDto;
import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import com.clenzy.integration.pricing.service.PricingConnectionService;
import com.clenzy.integration.pricing.strategy.PricingConnectionTestStrategy;
import com.clenzy.integration.pricing.strategy.PricingConnectionTestStrategyRegistry;
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
class PricingConnectionControllerTest {

    @Mock private PricingConnectionService service;
    @Mock private PricingConnectionTestStrategyRegistry strategyRegistry;
    @Mock private TenantContext tenantContext;

    private PricingConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new PricingConnectionController(service, strategyRegistry, tenantContext);
        jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("sub", "u-1").claim("user_id", 42L)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private PricingConnectionRequest req() {
        return new PricingConnectionRequest("https://pricelabs.test", "acct", "api-key-xx");
    }

    @Test
    void connect_strategyMissing_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(strategyRegistry.findFor(PricingProviderType.PRICELABS)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.connect(PricingProviderType.PRICELABS, req(), jwt))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connect_testFails_400() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PricingConnectionTestStrategy s = mock(PricingConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(false);
        when(strategyRegistry.findFor(PricingProviderType.BEYOND)).thenReturn(Optional.of(s));

        ResponseEntity<?> response = controller.connect(PricingProviderType.BEYOND, req(), jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void connect_success_saves() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PricingConnectionTestStrategy s = mock(PricingConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(PricingProviderType.WHEELHOUSE)).thenReturn(Optional.of(s));

        PricingConnection conn = new PricingConnection();
        conn.setProviderType(PricingProviderType.WHEELHOUSE);
        when(service.saveConnection(eq(1L), eq(42L), eq(PricingProviderType.WHEELHOUSE),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(PricingProviderType.WHEELHOUSE, req(), jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(PricingProviderType.WHEELHOUSE),
                anyString(), any(), anyString());
    }

    @Test
    void connect_jwtNull_userIdNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PricingConnectionTestStrategy s = mock(PricingConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(PricingProviderType.PRICELABS)).thenReturn(Optional.of(s));
        PricingConnection conn = new PricingConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(PricingProviderType.PRICELABS, req(), null);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtStringUserId_parses() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt strJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "100")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        PricingConnectionTestStrategy s = mock(PricingConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(PricingProviderType.PRICELABS)).thenReturn(Optional.of(s));
        PricingConnection conn = new PricingConnection();
        when(service.saveConnection(eq(1L), eq(100L), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(PricingProviderType.PRICELABS, req(), strJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtInvalidStringUserId_returnsNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt badJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "abc")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        PricingConnectionTestStrategy s = mock(PricingConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(PricingProviderType.PRICELABS)).thenReturn(Optional.of(s));
        PricingConnection conn = new PricingConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(PricingProviderType.PRICELABS, req(), badJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_connected_returnsDto() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PricingConnection conn = new PricingConnection();
        conn.setProviderType(PricingProviderType.PRICELABS);
        when(service.getConnection(1L, PricingProviderType.PRICELABS)).thenReturn(Optional.of(conn));

        ResponseEntity<PricingConnectionStatusDto> response = controller.status(PricingProviderType.PRICELABS);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void status_notConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, PricingProviderType.BEYOND)).thenReturn(Optional.empty());

        ResponseEntity<PricingConnectionStatusDto> response = controller.status(PricingProviderType.BEYOND);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void disconnect_true() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, PricingProviderType.PRICELABS)).thenReturn(true);

        ResponseEntity<?> response = controller.disconnect(PricingProviderType.PRICELABS);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", true);
    }

    @Test
    void disconnect_false() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, PricingProviderType.BEYOND)).thenReturn(false);

        ResponseEntity<?> response = controller.disconnect(PricingProviderType.BEYOND);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", false);
    }
}
