package com.clenzy.integration.partner.controller;

import com.clenzy.integration.partner.dto.PartnerConnectionRequest;
import com.clenzy.integration.partner.dto.PartnerConnectionStatusDto;
import com.clenzy.integration.partner.model.PartnerServiceConnection;
import com.clenzy.integration.partner.model.PartnerServiceType;
import com.clenzy.integration.partner.service.PartnerServiceConnectionService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PartnerConnectionControllerTest {

    @Mock private PartnerServiceConnectionService service;
    @Mock private TenantContext tenantContext;

    private PartnerConnectionController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new PartnerConnectionController(service, tenantContext);
        jwt = Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("sub", "u-1").claim("user_id", 42L)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private PartnerConnectionRequest req() {
        return new PartnerConnectionRequest("https://api.mailchimp.com/3.0", "us21", "api-key-xx");
    }

    @Test
    void connect_savesEncryptedConnection() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PartnerServiceConnection conn = new PartnerServiceConnection();
        conn.setProviderType(PartnerServiceType.MAILCHIMP);
        when(service.saveConnection(eq(1L), eq(42L), eq(PartnerServiceType.MAILCHIMP),
                anyString(), any(), anyString())).thenReturn(conn);

        ResponseEntity<PartnerConnectionStatusDto> response =
                controller.connect(PartnerServiceType.MAILCHIMP, req(), jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(service).saveConnection(eq(1L), eq(42L), eq(PartnerServiceType.MAILCHIMP),
                anyString(), any(), anyString());
    }

    @Test
    void status_notConnected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.getConnection(1L, PartnerServiceType.TURNO)).thenReturn(Optional.empty());

        ResponseEntity<PartnerConnectionStatusDto> response = controller.status(PartnerServiceType.TURNO);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().connected()).isFalse();
    }

    @Test
    void status_connected() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        PartnerServiceConnection conn = new PartnerServiceConnection();
        conn.setProviderType(PartnerServiceType.KLAVIYO);
        when(service.getConnection(1L, PartnerServiceType.KLAVIYO)).thenReturn(Optional.of(conn));

        ResponseEntity<PartnerConnectionStatusDto> response = controller.status(PartnerServiceType.KLAVIYO);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().connected()).isTrue();
    }

    @Test
    void disconnect_reportsDeletion() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(service.disconnect(1L, PartnerServiceType.SUPERHOG)).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.disconnect(PartnerServiceType.SUPERHOG);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("disconnected", true);
    }
}
