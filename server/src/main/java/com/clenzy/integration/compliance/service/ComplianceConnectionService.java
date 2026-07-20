package com.clenzy.integration.compliance.service;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.repository.ComplianceConnectionRepository;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Persistance + chiffrement pour les connexions de conformite legale.
 *
 * <p>Reutilise
 * {@link ApiKeyEncryptionService} (Jasypt AES-256) pour chiffrer les API
 * keys. Service applique le pattern repository — pas de logique business
 * (le test de connexion vit dans les strategies).</p>
 */
@Service
public class ComplianceConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceConnectionService.class);

    private final ComplianceConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public ComplianceConnectionService(ComplianceConnectionRepository repository,
                                          ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public ComplianceConnection saveConnection(Long organizationId, Long userId,
                                                  ComplianceProviderType providerType,
                                                  String serverUrl, String accountIdentifier,
                                                  String apiKey) {
        ComplianceConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(ComplianceConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(ComplianceConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());

        log.info("Compliance connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, ComplianceProviderType providerType) {
        Optional<ComplianceConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("Compliance connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<ComplianceConnection> getConnection(Long organizationId,
                                                          ComplianceProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId, ComplianceProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType)
                .map(c -> c.getStatus() == ComplianceConnection.Status.ACTIVE)
                .orElse(false);
    }

    public String decryptApiKey(ComplianceConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
