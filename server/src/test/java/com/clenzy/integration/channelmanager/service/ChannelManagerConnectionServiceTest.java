package com.clenzy.integration.channelmanager.service;

import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import com.clenzy.integration.channelmanager.repository.ChannelManagerConnectionRepository;
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
class ChannelManagerConnectionServiceTest {

    @Mock private ChannelManagerConnectionRepository repository;
    @Mock private ApiKeyEncryptionService encryption;
    @InjectMocks private ChannelManagerConnectionService service;

    @Test
    void saveConnection_createsNew() {
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.SITEMINDER))
            .thenReturn(Optional.empty());
        when(encryption.encrypt("key")).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ChannelManagerConnection result = service.saveConnection(1L, 2L,
            ChannelManagerProviderType.SITEMINDER, "https://x", "acc", "key");

        assertEquals(1L, result.getOrganizationId());
        assertEquals(ChannelManagerProviderType.SITEMINDER, result.getProviderType());
        assertEquals(ChannelManagerConnection.Status.ACTIVE, result.getStatus());
    }

    @Test
    void saveConnection_updatesExisting() {
        ChannelManagerConnection existing = new ChannelManagerConnection();
        existing.setId(7L);
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.HOSTAWAY))
            .thenReturn(Optional.of(existing));
        when(encryption.encrypt(any())).thenReturn("ENC");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ChannelManagerConnection result = service.saveConnection(1L, 2L,
            ChannelManagerProviderType.HOSTAWAY, "url", "ai", "k");

        assertEquals(7L, result.getId());
    }

    @Test
    void disconnect_existing_true() {
        ChannelManagerConnection conn = new ChannelManagerConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.CHANNEX))
            .thenReturn(Optional.of(conn));

        assertTrue(service.disconnect(1L, ChannelManagerProviderType.CHANNEX));
        verify(repository).delete(conn);
    }

    @Test
    void disconnect_absent_false() {
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.RENTALS_UNITED))
            .thenReturn(Optional.empty());

        assertFalse(service.disconnect(1L, ChannelManagerProviderType.RENTALS_UNITED));
    }

    @Test
    void getConnection_present() {
        ChannelManagerConnection conn = new ChannelManagerConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.CHANNEX))
            .thenReturn(Optional.of(conn));

        assertTrue(service.getConnection(1L, ChannelManagerProviderType.CHANNEX).isPresent());
    }

    @Test
    void isConnected_active_true() {
        ChannelManagerConnection conn = new ChannelManagerConnection();
        conn.setStatus(ChannelManagerConnection.Status.ACTIVE);
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.SITEMINDER))
            .thenReturn(Optional.of(conn));

        assertTrue(service.isConnected(1L, ChannelManagerProviderType.SITEMINDER));
    }

    @Test
    void isConnected_error_false() {
        ChannelManagerConnection conn = new ChannelManagerConnection();
        conn.setStatus(ChannelManagerConnection.Status.ERROR);
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.HOSTAWAY))
            .thenReturn(Optional.of(conn));

        assertFalse(service.isConnected(1L, ChannelManagerProviderType.HOSTAWAY));
    }

    @Test
    void isConnected_absent_false() {
        when(repository.findByOrganizationIdAndProviderType(1L, ChannelManagerProviderType.RENTALS_UNITED))
            .thenReturn(Optional.empty());

        assertFalse(service.isConnected(1L, ChannelManagerProviderType.RENTALS_UNITED));
    }

    @Test
    void decryptApiKey_delegates() {
        ChannelManagerConnection conn = new ChannelManagerConnection();
        conn.setApiKeyEncrypted("ENC");
        when(encryption.decrypt("ENC")).thenReturn("plain");

        assertEquals("plain", service.decryptApiKey(conn));
    }
}
