package com.clenzy.integration.pricing.service;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import com.clenzy.integration.pricing.repository.PricingConnectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PricingConnectionServiceTest {

    @Mock private PricingConnectionRepository repository;
    @Mock private ApiKeyEncryptionService encryption;
    @InjectMocks private PricingConnectionService service;

    @Test
    void saveConnection_createsNewWhenAbsent() {
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.PRICELABS))
            .thenReturn(Optional.empty());
        when(encryption.encrypt("key")).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PricingConnection result = service.saveConnection(1L, 2L,
            PricingProviderType.PRICELABS, "https://x", "acc", "key");

        assertEquals(1L, result.getOrganizationId());
        assertEquals(2L, result.getUserId());
        assertEquals(PricingProviderType.PRICELABS, result.getProviderType());
        assertEquals("ENC", result.getApiKeyEncrypted());
        assertEquals(PricingConnection.Status.ACTIVE, result.getStatus());
        assertNotNull(result.getLastTestedAt());
    }

    @Test
    void saveConnection_updatesExisting() {
        PricingConnection existing = new PricingConnection();
        existing.setId(99L);
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.BEYOND))
            .thenReturn(Optional.of(existing));
        when(encryption.encrypt("k")).thenReturn("E");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PricingConnection result = service.saveConnection(1L, 2L,
            PricingProviderType.BEYOND, "url", "ai", "k");

        assertEquals(99L, result.getId());
    }

    @Test
    void disconnect_existing_returnsTrue() {
        PricingConnection conn = new PricingConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.PRICELABS))
            .thenReturn(Optional.of(conn));

        boolean result = service.disconnect(1L, PricingProviderType.PRICELABS);

        assertTrue(result);
        verify(repository).delete(conn);
    }

    @Test
    void disconnect_absent_returnsFalse() {
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.WHEELHOUSE))
            .thenReturn(Optional.empty());

        boolean result = service.disconnect(1L, PricingProviderType.WHEELHOUSE);

        assertFalse(result);
        verify(repository, never()).delete(any());
    }

    @Test
    void getConnection_delegatesToRepository() {
        PricingConnection conn = new PricingConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.PRICELABS))
            .thenReturn(Optional.of(conn));

        Optional<PricingConnection> result = service.getConnection(1L, PricingProviderType.PRICELABS);

        assertTrue(result.isPresent());
    }

    @Test
    void isConnected_activeStatus_returnsTrue() {
        PricingConnection conn = new PricingConnection();
        conn.setStatus(PricingConnection.Status.ACTIVE);
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.PRICELABS))
            .thenReturn(Optional.of(conn));

        assertTrue(service.isConnected(1L, PricingProviderType.PRICELABS));
    }

    @Test
    void isConnected_errorStatus_returnsFalse() {
        PricingConnection conn = new PricingConnection();
        conn.setStatus(PricingConnection.Status.ERROR);
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.PRICELABS))
            .thenReturn(Optional.of(conn));

        assertFalse(service.isConnected(1L, PricingProviderType.PRICELABS));
    }

    @Test
    void isConnected_absent_returnsFalse() {
        when(repository.findByOrganizationIdAndProviderType(1L, PricingProviderType.BEYOND))
            .thenReturn(Optional.empty());

        assertFalse(service.isConnected(1L, PricingProviderType.BEYOND));
    }

    @Test
    void decryptApiKey_delegates() {
        PricingConnection conn = new PricingConnection();
        conn.setApiKeyEncrypted("ENC");
        when(encryption.decrypt("ENC")).thenReturn("plain");

        assertEquals("plain", service.decryptApiKey(conn));
    }
}
