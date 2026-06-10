package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class YousignSignatureProviderTest {

    @Mock private ExternalServiceConnectionService connectionService;
    @Mock private TenantContext tenantContext;
    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private RestTemplate restTemplate;

    private YousignSignatureProvider provider() {
        return new YousignSignatureProvider(connectionService, tenantContext,
                generationRepository, documentStorageService, restTemplate,
                "https://api.yousign.app/v3");
    }

    @Test
    void whenNoConnectionForOrg_thenCreateFails() {
        when(connectionService.getConnection(1L, SignatureProviderType.YOUSIGN))
                .thenReturn(Optional.empty());

        SignatureResult result = provider().createSignatureRequest(new SignatureRequest(
                7L, "Mandat", List.of(new Signer("owner@example.com", "Jean Dupont", "owner", 1)), null, 1L));

        assertFalse(result.success());
        assertTrue(result.errorMessage().contains("Yousign"));
        verifyNoInteractions(restTemplate);
    }

    @Test
    void whenNoSigner_thenCreateFails() {
        SignatureResult result = provider().createSignatureRequest(
                new SignatureRequest(7L, "Mandat", List.of(), null, 1L));

        assertFalse(result.success());
    }

    @Test
    void whenNoOrgInContext_thenUnavailable() {
        when(tenantContext.getOrganizationId()).thenReturn(null);

        assertFalse(provider().isAvailable());
    }

    @Test
    void whenOrgConnected_thenAvailable() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(connectionService.isConnected(1L, SignatureProviderType.YOUSIGN)).thenReturn(true);

        assertTrue(provider().isAvailable());
    }

    @Test
    void statusMapping_coversYousignLifecycle() {
        assertEquals(SignatureStatus.SIGNED, YousignSignatureProvider.mapStatus("done"));
        assertEquals(SignatureStatus.SENT, YousignSignatureProvider.mapStatus("ongoing"));
        assertEquals(SignatureStatus.EXPIRED, YousignSignatureProvider.mapStatus("expired"));
        assertEquals(SignatureStatus.CANCELLED, YousignSignatureProvider.mapStatus("canceled"));
        assertEquals(SignatureStatus.DECLINED, YousignSignatureProvider.mapStatus("declined"));
        assertEquals(SignatureStatus.PENDING, YousignSignatureProvider.mapStatus("draft"));
        assertEquals(SignatureStatus.PENDING, YousignSignatureProvider.mapStatus(null));
    }
}
