package com.clenzy.integration.docuseal;

import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DocuSealSignatureProviderTest {

    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private RestTemplate restTemplate;

    private DocuSealSignatureProvider provider(String baseUrl, String apiKey) {
        DocuSealConfig config = new DocuSealConfig();
        config.setBaseUrl(baseUrl);
        config.setApiKey(apiKey);
        return new DocuSealSignatureProvider(config, generationRepository, documentStorageService, restTemplate);
    }

    @Test
    void whenInstanceNotConfigured_thenUnavailableAndCreateFails() {
        DocuSealSignatureProvider provider = provider("", "");

        assertFalse(provider.isAvailable());

        SignatureResult result = provider.createSignatureRequest(new SignatureRequest(
                7L, "Mandat", List.of(new Signer("owner@example.com", "Jean Dupont", "owner", 1)), null, 1L));
        assertFalse(result.success());
        assertTrue(result.errorMessage().contains("DocuSeal"));
        verifyNoInteractions(restTemplate);
    }

    @Test
    void whenInstanceConfigured_thenAvailable() {
        assertTrue(provider("https://sign.clenzy.fr", "secret").isAvailable());
    }

    @Test
    void whenNoSigner_thenCreateFails() {
        SignatureResult result = provider("https://sign.clenzy.fr", "secret")
                .createSignatureRequest(new SignatureRequest(7L, "Mandat", List.of(), null, 1L));

        assertFalse(result.success());
    }

    @Test
    void statusMapping_coversDocuSealLifecycle() {
        assertEquals(SignatureStatus.SIGNED, DocuSealSignatureProvider.mapStatus("completed"));
        assertEquals(SignatureStatus.EXPIRED, DocuSealSignatureProvider.mapStatus("expired"));
        assertEquals(SignatureStatus.CANCELLED, DocuSealSignatureProvider.mapStatus("archived"));
        assertEquals(SignatureStatus.DECLINED, DocuSealSignatureProvider.mapStatus("declined"));
        assertEquals(SignatureStatus.PENDING, DocuSealSignatureProvider.mapStatus("pending"));
        assertEquals(SignatureStatus.PENDING, DocuSealSignatureProvider.mapStatus(null));
    }
}
