package com.clenzy.integration.compliance.service;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.repository.ComplianceConnectionRepository;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
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
class ComplianceConnectionServiceTest {

    @Mock private ComplianceConnectionRepository repository;
    @Mock private ApiKeyEncryptionService encryption;
    @InjectMocks private ComplianceConnectionService service;

    @Test
    void saveConnection_createsNew() {
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.CHEKIN))
            .thenReturn(Optional.empty());
        when(encryption.encrypt("key")).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ComplianceConnection result = service.saveConnection(1L, 2L,
            ComplianceProviderType.CHEKIN, "https://x", "acc", "key");

        assertEquals(1L, result.getOrganizationId());
        assertEquals(2L, result.getUserId());
        assertEquals(ComplianceProviderType.CHEKIN, result.getProviderType());
        assertEquals("ENC", result.getApiKeyEncrypted());
        assertEquals(ComplianceConnection.Status.ACTIVE, result.getStatus());
        assertNull(result.getErrorMessage());
        assertNotNull(result.getLastTestedAt());
    }

    @Test
    void saveConnection_updatesExisting() {
        ComplianceConnection existing = new ComplianceConnection();
        existing.setId(42L);
        existing.setErrorMessage("previous error");
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.POLICE_MA))
            .thenReturn(Optional.of(existing));
        when(encryption.encrypt(any())).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ComplianceConnection result = service.saveConnection(1L, 2L,
            ComplianceProviderType.POLICE_MA, "url", "ai", "k");

        assertEquals(42L, result.getId());
        assertNull(result.getErrorMessage());
    }

    @Test
    void disconnect_existing_returnsTrue() {
        ComplianceConnection conn = new ComplianceConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.CHEKIN))
            .thenReturn(Optional.of(conn));

        assertTrue(service.disconnect(1L, ComplianceProviderType.CHEKIN));
        verify(repository).delete(conn);
    }

    @Test
    void disconnect_absent_returnsFalse() {
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.ABSHER_KSA))
            .thenReturn(Optional.empty());

        assertFalse(service.disconnect(1L, ComplianceProviderType.ABSHER_KSA));
    }

    @Test
    void getConnection_delegates() {
        ComplianceConnection conn = new ComplianceConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.CHEKIN))
            .thenReturn(Optional.of(conn));

        assertTrue(service.getConnection(1L, ComplianceProviderType.CHEKIN).isPresent());
    }

    @Test
    void isConnected_active_true() {
        ComplianceConnection conn = new ComplianceConnection();
        conn.setStatus(ComplianceConnection.Status.ACTIVE);
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.CHEKIN))
            .thenReturn(Optional.of(conn));

        assertTrue(service.isConnected(1L, ComplianceProviderType.CHEKIN));
    }

    @Test
    void isConnected_inactive_false() {
        ComplianceConnection conn = new ComplianceConnection();
        conn.setStatus(ComplianceConnection.Status.ERROR);
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.POLICE_MA))
            .thenReturn(Optional.of(conn));

        assertFalse(service.isConnected(1L, ComplianceProviderType.POLICE_MA));
    }

    @Test
    void isConnected_absent_false() {
        when(repository.findByOrganizationIdAndProviderType(1L, ComplianceProviderType.ABSHER_KSA))
            .thenReturn(Optional.empty());

        assertFalse(service.isConnected(1L, ComplianceProviderType.ABSHER_KSA));
    }

    @Test
    void decryptApiKey_delegates() {
        ComplianceConnection conn = new ComplianceConnection();
        conn.setApiKeyEncrypted("ENC");
        when(encryption.decrypt("ENC")).thenReturn("plain");

        assertEquals("plain", service.decryptApiKey(conn));
    }
}
