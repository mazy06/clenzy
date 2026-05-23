package com.clenzy.integration.pricing.service;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import com.clenzy.integration.pricing.repository.PricingConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Persistance + chiffrement pour les connexions PriceLabs / Beyond.
 *
 * <p>Mirror de {@code ExternalServiceConnectionService} mais sur la table
 * {@code pricing_connections}. On reutilise {@link ApiKeyEncryptionService}
 * (deja en place — Jasypt AES-256) pour le chiffrement de l'API key.</p>
 */
@Service
public class PricingConnectionService {

    private static final Logger log = LoggerFactory.getLogger(PricingConnectionService.class);

    private final PricingConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public PricingConnectionService(PricingConnectionRepository repository,
                                       ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public PricingConnection saveConnection(Long organizationId, Long userId,
                                              PricingProviderType providerType,
                                              String serverUrl, String accountIdentifier,
                                              String apiKey) {
        PricingConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(PricingConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(PricingConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());

        log.info("Pricing connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, PricingProviderType providerType) {
        Optional<PricingConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("Pricing connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<PricingConnection> getConnection(Long organizationId,
                                                       PricingProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId, PricingProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType)
                .map(c -> c.getStatus() == PricingConnection.Status.ACTIVE)
                .orElse(false);
    }

    public String decryptApiKey(PricingConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
