package com.clenzy.integration.external;

import com.clenzy.integration.docusign.config.DocuSignConfig;
import com.clenzy.integration.docusign.service.DocuSignOAuthService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocuSignSignatureProviderTest {

    @Mock private DocuSignConfig config;
    @Mock private DocuSignOAuthService oauthService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private DocuSignSignatureProvider provider;

    @Test
    void getType_returnsDocuSign() {
        assertEquals(SignatureProviderType.DOCUSIGN, provider.getType());
    }

    @Test
    void isAvailable_notConfigured_returnsFalse() {
        when(config.isConfigured()).thenReturn(false);
        assertFalse(provider.isAvailable());
        verifyNoInteractions(tenantContext, oauthService);
    }

    @Test
    void isAvailable_configuredButNoOrg_returnsFalse() {
        when(config.isConfigured()).thenReturn(true);
        when(tenantContext.getOrganizationId()).thenReturn(null);
        assertFalse(provider.isAvailable());
    }

    @Test
    void isAvailable_configuredAndConnected_returnsTrue() {
        when(config.isConfigured()).thenReturn(true);
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(true);
        assertTrue(provider.isAvailable());
    }

    @Test
    void isAvailable_configuredButNotConnected_returnsFalse() {
        when(config.isConfigured()).thenReturn(true);
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(false);
        assertFalse(provider.isAvailable());
    }

    @Test
    void createSignatureRequest_notImplemented_throwsUnsupported() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(true);
        SignatureRequest request = mock(SignatureRequest.class);
        assertThrows(UnsupportedOperationException.class,
            () -> provider.createSignatureRequest(request));
    }

    @Test
    void createSignatureRequest_notConnected_throwsIllegalState() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(false);
        SignatureRequest request = mock(SignatureRequest.class);
        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> provider.createSignatureRequest(request));
        assertTrue(ex.getMessage().contains("DocuSign"));
        assertTrue(ex.getMessage().contains("connectee"));
    }

    @Test
    void getStatus_notConnected_throwsIllegalState() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> provider.getStatus("env-1"));
    }

    @Test
    void getStatus_connected_throwsUnsupported() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(true);
        assertThrows(UnsupportedOperationException.class, () -> provider.getStatus("env-1"));
    }

    @Test
    void getSignedDocument_notConnected_throwsIllegalState() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> provider.getSignedDocument("env-1"));
    }

    @Test
    void getSignedDocument_connected_throwsUnsupported() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(oauthService.isConnected(7L)).thenReturn(true);
        assertThrows(UnsupportedOperationException.class, () -> provider.getSignedDocument("env-1"));
    }
}
