package com.clenzy.integration.kyc.service;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import com.clenzy.integration.kyc.repository.KycConnectionRepository;
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
class KycConnectionServiceTest {

    @Mock private KycConnectionRepository repository;
    @Mock private ApiKeyEncryptionService encryption;
    @InjectMocks private KycConnectionService service;

    @Test
    void saveConnection_createsNew() {
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.SUMSUB))
            .thenReturn(Optional.empty());
        when(encryption.encrypt("key")).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KycConnection result = service.saveConnection(1L, 2L,
            KycProviderType.SUMSUB, "https://x", "acc", "key");

        assertEquals(1L, result.getOrganizationId());
        assertEquals(KycProviderType.SUMSUB, result.getProviderType());
        assertEquals(KycConnection.Status.ACTIVE, result.getStatus());
        assertNotNull(result.getLastTestedAt());
    }

    @Test
    void saveConnection_updatesExisting() {
        KycConnection existing = new KycConnection();
        existing.setId(10L);
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.VERIFF))
            .thenReturn(Optional.of(existing));
        when(encryption.encrypt(any())).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KycConnection result = service.saveConnection(1L, 2L,
            KycProviderType.VERIFF, "url", "ai", "k");

        assertEquals(10L, result.getId());
    }

    @Test
    void disconnect_existing_returnsTrue() {
        KycConnection conn = new KycConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.SUMSUB))
            .thenReturn(Optional.of(conn));

        assertTrue(service.disconnect(1L, KycProviderType.SUMSUB));
        verify(repository).delete(conn);
    }

    @Test
    void disconnect_absent_returnsFalse() {
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.ONFIDO))
            .thenReturn(Optional.empty());

        assertFalse(service.disconnect(1L, KycProviderType.ONFIDO));
    }

    @Test
    void getConnection_delegates() {
        KycConnection conn = new KycConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.SUMSUB))
            .thenReturn(Optional.of(conn));

        assertTrue(service.getConnection(1L, KycProviderType.SUMSUB).isPresent());
    }

    @Test
    void isConnected_active_true() {
        KycConnection conn = new KycConnection();
        conn.setStatus(KycConnection.Status.ACTIVE);
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.SUMSUB))
            .thenReturn(Optional.of(conn));

        assertTrue(service.isConnected(1L, KycProviderType.SUMSUB));
    }

    @Test
    void isConnected_revoked_false() {
        KycConnection conn = new KycConnection();
        conn.setStatus(KycConnection.Status.REVOKED);
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.VERIFF))
            .thenReturn(Optional.of(conn));

        assertFalse(service.isConnected(1L, KycProviderType.VERIFF));
    }

    @Test
    void isConnected_absent_false() {
        when(repository.findByOrganizationIdAndProviderType(1L, KycProviderType.ONFIDO))
            .thenReturn(Optional.empty());

        assertFalse(service.isConnected(1L, KycProviderType.ONFIDO));
    }

    @Test
    void decryptApiKey_delegates() {
        KycConnection conn = new KycConnection();
        conn.setApiKeyEncrypted("ENC");
        when(encryption.decrypt("ENC")).thenReturn("plain");

        assertEquals("plain", service.decryptApiKey(conn));
    }
}
