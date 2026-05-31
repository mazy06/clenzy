package com.clenzy.integration.channelmanager.controller;

import com.clenzy.integration.channelmanager.dto.ChannelManagerConnectionRequest;
import com.clenzy.integration.channelmanager.dto.ChannelManagerConnectionStatusDto;
import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import com.clenzy.integration.channelmanager.service.ChannelManagerConnectionService;
import com.clenzy.integration.channelmanager.strategy.ChannelManagerConnectionTestStrategy;
import com.clenzy.integration.channelmanager.strategy.ChannelManagerConnectionTestStrategyRegistry;
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
class ChannelManagerConnectionControllerTest {

    @Mock private ChannelManagerConnectionService service;
    @Mock private ChannelManagerConnectionTestStrategyRegistry strategyRegistry;
    @Mock private TenantContext tenantContext;

    private ChannelManagerConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ChannelManagerConnectionController(service, strategyRegistry, tenantContext);
        jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("sub", "u-1").claim("user_id", 42L)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private ChannelManagerConnectionRequest req() {
        return new ChannelManagerConnectionRequest("https://siteminder.test", "acct", "api-key-xx");
    }

    @Test
    void connect_strategyMissing_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(strategyRegistry.findFor(ChannelManagerProviderType.SITEMINDER)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> controller.connect(ChannelManagerProviderType.SITEMINDER, req(), jwt))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void connect_testFails_400() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ChannelManagerConnectionTestStrategy s = mock(ChannelManagerConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(false);
        when(strategyRegistry.findFor(ChannelManagerProviderType.HOSTAWAY)).thenReturn(Optional.of(s));

        ResponseEntity<?> response = controller.connect(ChannelManagerProviderType.HOSTAWAY, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void connect_success() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ChannelManagerConnectionTestStrategy s = mock(ChannelManagerConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ChannelManagerProviderType.CHANNEX)).thenReturn(Optional.of(s));

        ChannelManagerConnection conn = new ChannelManagerConnection();
        conn.setProviderType(ChannelManagerProviderType.CHANNEX);
        when(service.saveConnection(eq(1L), eq(42L), eq(ChannelManagerProviderType.CHANNEX),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ChannelManagerProviderType.CHANNEX, req(), jwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(ChannelManagerProviderType.CHANNEX),
                anyString(), any(), anyString());
    }

    @Test
    void connect_jwtNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ChannelManagerConnectionTestStrategy s = mock(ChannelManagerConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ChannelManagerProviderType.SITEMINDER)).thenReturn(Optional.of(s));
        ChannelManagerConnection conn = new ChannelManagerConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ChannelManagerProviderType.SITEMINDER, req(), null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtStringUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt strJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "55")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ChannelManagerConnectionTestStrategy s = mock(ChannelManagerConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ChannelManagerProviderType.RENTALS_UNITED)).thenReturn(Optional.of(s));
        ChannelManagerConnection conn = new ChannelManagerConnection();
        when(service.saveConnection(eq(1L), eq(55L), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ChannelManagerProviderType.RENTALS_UNITED, req(), strJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void connect_jwtBadUserId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Jwt badJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "u").claim("user_id", "notnum")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();

        ChannelManagerConnectionTestStrategy s = mock(ChannelManagerConnectionTestStrategy.class);
        when(s.testConnection(anyString(), anyString(), anyString())).thenReturn(true);
        when(strategyRegistry.findFor(ChannelManagerProviderType.HOSTAWAY)).thenReturn(Optional.of(s));
        ChannelManagerConnection conn = new ChannelManagerConnection();
        when(service.saveConnection(eq(1L), eq(null), any(), anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<?> response = controller.connect(ChannelManagerProviderType.HOSTAWAY, req(), badJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_connected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        ChannelManagerConnection conn = new ChannelManagerConnection();
        conn.setProviderType(ChannelManagerProviderType.SITEMINDER);
        when(service.getConnection(1L, ChannelManagerProviderType.SITEMINDER)).thenReturn(Optional.of(conn));

        ResponseEntity<ChannelManagerConnectionStatusDto> response = controller.status(ChannelManagerProviderType.SITEMINDER);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void status_notConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, ChannelManagerProviderType.HOSTAWAY)).thenReturn(Optional.empty());

        ResponseEntity<ChannelManagerConnectionStatusDto> response = controller.status(ChannelManagerProviderType.HOSTAWAY);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void disconnect_true() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, ChannelManagerProviderType.SITEMINDER)).thenReturn(true);

        ResponseEntity<?> response = controller.disconnect(ChannelManagerProviderType.SITEMINDER);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", true);
    }

    @Test
    void disconnect_false() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, ChannelManagerProviderType.HOSTAWAY)).thenReturn(false);

        ResponseEntity<?> response = controller.disconnect(ChannelManagerProviderType.HOSTAWAY);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("disconnected", false);
    }
}
