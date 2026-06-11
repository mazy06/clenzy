package com.clenzy.service;

import com.clenzy.dto.IntegrationPartnerDto;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationCategory;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import com.clenzy.repository.IntegrationPartnerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketplaceServiceTest {

    @Mock private IntegrationPartnerRepository partnerRepository;

    // Vrai service de chiffrement (Jasypt) avec une cle de test : permet d'asserter
    // que la cle API est bien chiffree au repos (M1-MODEL-02), pas un mock opaque.
    private final ApiKeyEncryptionService encryption =
            new ApiKeyEncryptionService("test-marketplace-encryption-password");

    private MarketplaceService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new MarketplaceService(partnerRepository, encryption);
    }

    private IntegrationPartner createPartner(IntegrationStatus status) {
        IntegrationPartner p = new IntegrationPartner();
        p.setId(1L);
        p.setOrganizationId(ORG_ID);
        p.setPartnerName("PriceLabs");
        p.setPartnerSlug("pricelabs");
        p.setCategory(IntegrationCategory.PRICING);
        p.setDescription("Dynamic pricing");
        p.setStatus(status);
        return p;
    }

    @Test
    void connectIntegration_success() {
        IntegrationPartner partner = createPartner(IntegrationStatus.AVAILABLE);
        when(partnerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(partner));
        when(partnerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IntegrationPartnerDto result = service.connectIntegration(1L, ORG_ID, "api_key_123", null);

        assertEquals(IntegrationStatus.CONNECTED, result.status());
        assertNotNull(result.connectedAt());
    }

    @Test
    void connectIntegration_encryptsApiKeyAtRest() {
        // M1-MODEL-02 : la cle API ne doit JAMAIS etre stockee en clair.
        IntegrationPartner partner = createPartner(IntegrationStatus.AVAILABLE);
        when(partnerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(partner));
        when(partnerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.connectIntegration(1L, ORG_ID, "api_key_123", null);

        // La valeur persistee est du ciphertext (differente de la valeur en clair)...
        assertNotNull(partner.getApiKeyEncrypted());
        assertNotEquals("api_key_123", partner.getApiKeyEncrypted());
        // ...et est dechiffrable cote applicatif a l'usage.
        assertEquals("api_key_123", service.decryptApiKey(partner));
    }

    @Test
    void connectIntegration_notFound_throws() {
        when(partnerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
            () -> service.connectIntegration(1L, ORG_ID, "key", null));
    }

    @Test
    void disconnectIntegration_success() {
        IntegrationPartner partner = createPartner(IntegrationStatus.CONNECTED);
        partner.setApiKeyEncrypted("encrypted_key");
        when(partnerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(partner));
        when(partnerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IntegrationPartnerDto result = service.disconnectIntegration(1L, ORG_ID);

        assertEquals(IntegrationStatus.DISCONNECTED, result.status());
        assertNull(partner.getApiKeyEncrypted());
    }

    @Test
    void initializeCatalog_createsNewEntries() {
        when(partnerRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of());
        when(partnerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int count = service.initializeCatalog(ORG_ID);

        assertTrue(count > 0);
        verify(partnerRepository, times(count)).save(any());
    }

    @Test
    void initializeCatalog_skipsExisting() {
        IntegrationPartner existing = createPartner(IntegrationStatus.CONNECTED);
        when(partnerRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(existing));
        when(partnerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int count = service.initializeCatalog(ORG_ID);

        // Should skip "pricelabs" since it already exists
        int catalogSize = service.getCatalog().size();
        assertEquals(catalogSize - 1, count);
    }

    @Test
    void getCatalog_returnsAllEntries() {
        var catalog = service.getCatalog();

        assertFalse(catalog.isEmpty());
        assertTrue(catalog.stream().allMatch(e -> e.containsKey("name")));
        assertTrue(catalog.stream().allMatch(e -> e.containsKey("slug")));
        assertTrue(catalog.stream().allMatch(e -> e.containsKey("category")));
    }

    @Test
    void getConnected_filtersCorrectly() {
        IntegrationPartner connected = createPartner(IntegrationStatus.CONNECTED);
        when(partnerRepository.findByStatus(IntegrationStatus.CONNECTED, ORG_ID))
            .thenReturn(List.of(connected));

        List<IntegrationPartnerDto> result = service.getConnected(ORG_ID);

        assertEquals(1, result.size());
        assertEquals(IntegrationStatus.CONNECTED, result.get(0).status());
    }
}
