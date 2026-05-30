package com.clenzy.integration.external.service;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.repository.ExternalServiceConnectionRepository;
import com.clenzy.service.signature.SignatureProviderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalServiceConnectionServiceTest {

    @Mock private ExternalServiceConnectionRepository repository;
    @Mock private ApiKeyEncryptionService encryption;

    private ExternalServiceConnectionService service;

    @BeforeEach
    void setUp() {
        service = new ExternalServiceConnectionService(repository, encryption);
        lenient().when(encryption.encrypt(anyString())).thenAnswer(inv -> "ENC:" + inv.getArgument(0));
        lenient().when(encryption.decrypt(anyString())).thenAnswer(inv -> {
            String s = inv.getArgument(0);
            return s.startsWith("ENC:") ? s.substring(4) : s;
        });
    }

    @Test
    void saveConnection_createsNewWhenMissing() {
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.YOUSIGN))
                .thenReturn(Optional.empty());
        when(repository.save(any(ExternalServiceConnection.class)))
                .thenAnswer(inv -> {
                    ExternalServiceConnection c = inv.getArgument(0);
                    c.setId(99L);
                    return c;
                });

        ExternalServiceConnection saved = service.saveConnection(1L, 10L,
                SignatureProviderType.YOUSIGN, "https://server", "acct", "secret");

        assertThat(saved.getId()).isEqualTo(99L);
        assertThat(saved.getOrganizationId()).isEqualTo(1L);
        assertThat(saved.getStatus()).isEqualTo(ExternalServiceConnection.Status.ACTIVE);
        verify(encryption).encrypt("secret");
    }

    @Test
    void saveConnection_updatesExisting() {
        ExternalServiceConnection existing = new ExternalServiceConnection();
        existing.setId(5L);
        existing.setOrganizationId(1L);
        existing.setProviderType(SignatureProviderType.YOUSIGN);
        existing.setStatus(ExternalServiceConnection.Status.ERROR);
        existing.setErrorMessage("prev err");

        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.YOUSIGN))
                .thenReturn(Optional.of(existing));
        when(repository.save(any(ExternalServiceConnection.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ExternalServiceConnection saved = service.saveConnection(1L, 20L,
                SignatureProviderType.YOUSIGN, "https://new", "acct2", "newkey");

        assertThat(saved.getId()).isEqualTo(5L);
        assertThat(saved.getStatus()).isEqualTo(ExternalServiceConnection.Status.ACTIVE);
    }

    @Test
    void disconnect_existingConnection_returnsTrue() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setId(1L);
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.UNIVERSIGN))
                .thenReturn(Optional.of(conn));

        boolean result = service.disconnect(1L, SignatureProviderType.UNIVERSIGN);

        assertThat(result).isTrue();
        verify(repository).delete(conn);
    }

    @Test
    void disconnect_missingConnection_returnsFalse() {
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.UNIVERSIGN))
                .thenReturn(Optional.empty());

        boolean result = service.disconnect(1L, SignatureProviderType.UNIVERSIGN);

        assertThat(result).isFalse();
        verify(repository, never()).delete(any());
    }

    @Test
    void getConnection_passesThrough() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.DOCUSIGN))
                .thenReturn(Optional.of(conn));

        Optional<ExternalServiceConnection> result = service.getConnection(1L, SignatureProviderType.DOCUSIGN);

        assertThat(result).contains(conn);
    }

    @Test
    void isConnected_returnsTrueForActive() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setStatus(ExternalServiceConnection.Status.ACTIVE);
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.PENNYLANE))
                .thenReturn(Optional.of(conn));

        assertThat(service.isConnected(1L, SignatureProviderType.PENNYLANE)).isTrue();
    }

    @Test
    void isConnected_returnsFalseForError() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setStatus(ExternalServiceConnection.Status.ERROR);
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.PENNYLANE))
                .thenReturn(Optional.of(conn));

        assertThat(service.isConnected(1L, SignatureProviderType.PENNYLANE)).isFalse();
    }

    @Test
    void isConnected_returnsFalseForRevoked() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setStatus(ExternalServiceConnection.Status.REVOKED);
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.PENNYLANE))
                .thenReturn(Optional.of(conn));

        assertThat(service.isConnected(1L, SignatureProviderType.PENNYLANE)).isFalse();
    }

    @Test
    void isConnected_returnsFalseWhenMissing() {
        when(repository.findByOrganizationIdAndProviderType(1L, SignatureProviderType.YOUSIGN))
                .thenReturn(Optional.empty());

        assertThat(service.isConnected(1L, SignatureProviderType.YOUSIGN)).isFalse();
    }

    @Test
    void decryptApiKey_delegatesToEncryptionService() {
        ExternalServiceConnection conn = new ExternalServiceConnection();
        conn.setApiKeyEncrypted("ENC:my-secret");

        String result = service.decryptApiKey(conn);

        assertThat(result).isEqualTo("my-secret");
        verify(encryption).decrypt("ENC:my-secret");
    }
}
