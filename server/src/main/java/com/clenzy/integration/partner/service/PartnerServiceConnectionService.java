package com.clenzy.integration.partner.service;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.partner.model.PartnerServiceConnection;
import com.clenzy.integration.partner.model.PartnerServiceType;
import com.clenzy.integration.partner.repository.PartnerServiceConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Persistance + chiffrement pour les connexions aux services partenaires du
 * catalogue (mirror de {@code ComplianceConnectionService}). Reutilise
 * {@link ApiKeyEncryptionService} (Jasypt AES-256) pour chiffrer les API keys.
 */
@Service
public class PartnerServiceConnectionService {

    private static final Logger log = LoggerFactory.getLogger(PartnerServiceConnectionService.class);

    private final PartnerServiceConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public PartnerServiceConnectionService(PartnerServiceConnectionRepository repository,
                                           ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public PartnerServiceConnection saveConnection(Long organizationId, Long userId,
                                                   PartnerServiceType providerType,
                                                   String serverUrl, String accountIdentifier,
                                                   String apiKey) {
        PartnerServiceConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(PartnerServiceConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(PartnerServiceConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());

        log.info("Partner connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, PartnerServiceType providerType) {
        Optional<PartnerServiceConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("Partner connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<PartnerServiceConnection> getConnection(Long organizationId,
                                                            PartnerServiceType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    public String decryptApiKey(PartnerServiceConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
