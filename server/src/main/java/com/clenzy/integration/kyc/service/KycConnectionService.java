package com.clenzy.integration.kyc.service;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import com.clenzy.integration.kyc.repository.KycConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Persistance + chiffrement pour les connexions KYC. Mirror des autres
 * services API key (pricing, compliance), reutilise ApiKeyEncryptionService
 * deja en place.
 */
@Service
public class KycConnectionService {

    private static final Logger log = LoggerFactory.getLogger(KycConnectionService.class);

    private final KycConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public KycConnectionService(KycConnectionRepository repository,
                                  ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public KycConnection saveConnection(Long organizationId, Long userId,
                                          KycProviderType providerType,
                                          String serverUrl, String accountIdentifier,
                                          String apiKey) {
        KycConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(KycConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(KycConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());

        log.info("KYC connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, KycProviderType providerType) {
        Optional<KycConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("KYC connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<KycConnection> getConnection(Long organizationId, KycProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId, KycProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType)
                .map(c -> c.getStatus() == KycConnection.Status.ACTIVE)
                .orElse(false);
    }

    public String decryptApiKey(KycConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
