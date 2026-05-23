package com.clenzy.integration.external.service;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.repository.ExternalServiceConnectionRepository;
import com.clenzy.service.signature.SignatureProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Service unifie pour la gestion des connexions API a tous les providers de
 * signature electronique base sur API key (Yousign, Universign, DocaPoste, etc.).
 *
 * Reutilise {@link ApiKeyEncryptionService} (deja existant) pour chiffrer
 * les API keys. Le service ne contient PAS de logique specifique provider —
 * c'est de la pure persistance + chiffrement. Les test de connexion + les
 * appels effectifs vivent dans des {@link com.clenzy.service.signature.SignatureProvider}
 * dedies par provider.
 *
 * <h2>Pour Pennylane / DocuSign (OAuth)</h2>
 * Ils utilisent leurs propres entities (PennylaneConnection / a venir pour
 * DocuSign) car ils ont besoin de access_token + refresh_token + expiration,
 * pas juste une API key.
 */
@Service
public class ExternalServiceConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ExternalServiceConnectionService.class);

    private final ExternalServiceConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public ExternalServiceConnectionService(ExternalServiceConnectionRepository repository,
                                              ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public ExternalServiceConnection saveConnection(Long organizationId, Long userId,
                                                      SignatureProviderType providerType,
                                                      String serverUrl, String accountIdentifier,
                                                      String apiKey) {
        ExternalServiceConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(ExternalServiceConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(ExternalServiceConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());
        if (conn.getId() == null) {
            conn.setCreatedAt(Instant.now());
        }
        conn.setUpdatedAt(Instant.now());

        log.info("External connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, SignatureProviderType providerType) {
        Optional<ExternalServiceConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("External connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<ExternalServiceConnection> getConnection(Long organizationId,
                                                               SignatureProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId, SignatureProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType)
                .map(c -> c.getStatus() == ExternalServiceConnection.Status.ACTIVE)
                .orElse(false);
    }

    /** Decrypte l'API key pour usage interne par les SignatureProvider implementations. */
    public String decryptApiKey(ExternalServiceConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
