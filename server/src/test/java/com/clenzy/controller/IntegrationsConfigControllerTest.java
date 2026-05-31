package com.clenzy.controller;

import com.clenzy.model.OrgIntegrationConfig;
import com.clenzy.repository.OrgIntegrationConfigRepository;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IntegrationsConfigControllerTest {

    @Mock private OrgIntegrationConfigRepository repository;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private IntegrationsConfigController controller;

    @BeforeEach
    void setUp() {
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
    }

    @Test
    void getConfig_existingConfig_returnsProvider() {
        OrgIntegrationConfig config = new OrgIntegrationConfig();
        config.setSignatureProvider(SignatureProviderType.PENNYLANE);
        when(repository.findByOrganizationId(7L)).thenReturn(Optional.of(config));

        ResponseEntity<Map<String, Object>> response = controller.getConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(SignatureProviderType.PENNYLANE, response.getBody().get("signatureProvider"));
    }

    @Test
    void getConfig_noConfig_returnsNullProvider() {
        when(repository.findByOrganizationId(7L)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.getConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNull(response.getBody().get("signatureProvider"));
    }

    @Test
    void setSignatureProvider_existingConfig_updatesIt() {
        OrgIntegrationConfig existing = new OrgIntegrationConfig();
        existing.setOrganizationId(7L);
        existing.setSignatureProvider(SignatureProviderType.PENNYLANE);
        when(repository.findByOrganizationId(7L)).thenReturn(Optional.of(existing));
        when(repository.save(any(OrgIntegrationConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new IntegrationsConfigController.UpdateSignatureProviderRequest(SignatureProviderType.DOCUSIGN);
        ResponseEntity<Map<String, Object>> response = controller.setSignatureProvider(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(SignatureProviderType.DOCUSIGN, response.getBody().get("signatureProvider"));

        ArgumentCaptor<OrgIntegrationConfig> captor = ArgumentCaptor.forClass(OrgIntegrationConfig.class);
        verify(repository).save(captor.capture());
        assertEquals(SignatureProviderType.DOCUSIGN, captor.getValue().getSignatureProvider());
        assertNotNull(captor.getValue().getUpdatedAt());
    }

    @Test
    void setSignatureProvider_newConfig_createdAndSaved() {
        when(repository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(repository.save(any(OrgIntegrationConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new IntegrationsConfigController.UpdateSignatureProviderRequest(SignatureProviderType.YOUSIGN);
        ResponseEntity<Map<String, Object>> response = controller.setSignatureProvider(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(SignatureProviderType.YOUSIGN, response.getBody().get("signatureProvider"));

        ArgumentCaptor<OrgIntegrationConfig> captor = ArgumentCaptor.forClass(OrgIntegrationConfig.class);
        verify(repository).save(captor.capture());
        assertEquals(7L, captor.getValue().getOrganizationId());
        assertEquals(SignatureProviderType.YOUSIGN, captor.getValue().getSignatureProvider());
        assertNotNull(captor.getValue().getCreatedAt());
    }

    @Test
    void setSignatureProvider_nullRequestBody_setsProviderNull() {
        when(repository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(repository.save(any(OrgIntegrationConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<Map<String, Object>> response = controller.setSignatureProvider(null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNull(response.getBody().get("signatureProvider"));
        verify(repository).save(any(OrgIntegrationConfig.class));
    }
}
