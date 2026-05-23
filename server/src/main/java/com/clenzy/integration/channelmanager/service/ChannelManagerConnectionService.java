package com.clenzy.integration.channelmanager.service;

import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import com.clenzy.integration.channelmanager.repository.ChannelManagerConnectionRepository;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/** Persistance + chiffrement pour les connexions Channel Manager. */
@Service
public class ChannelManagerConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ChannelManagerConnectionService.class);

    private final ChannelManagerConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public ChannelManagerConnectionService(ChannelManagerConnectionRepository repository,
                                              ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public ChannelManagerConnection saveConnection(Long organizationId, Long userId,
                                                      ChannelManagerProviderType providerType,
                                                      String serverUrl, String accountIdentifier,
                                                      String apiKey) {
        ChannelManagerConnection conn = repository
                .findByOrganizationIdAndProviderType(organizationId, providerType)
                .orElseGet(ChannelManagerConnection::new);

        conn.setOrganizationId(organizationId);
        conn.setUserId(userId);
        conn.setProviderType(providerType);
        conn.setServerUrl(serverUrl);
        conn.setAccountIdentifier(accountIdentifier);
        conn.setApiKeyEncrypted(encryption.encrypt(apiKey));
        conn.setStatus(ChannelManagerConnection.Status.ACTIVE);
        conn.setErrorMessage(null);
        conn.setLastTestedAt(Instant.now());

        log.info("ChannelManager connection saved: org={} provider={}", organizationId, providerType);
        return repository.save(conn);
    }

    @Transactional
    public boolean disconnect(Long organizationId, ChannelManagerProviderType providerType) {
        Optional<ChannelManagerConnection> existing =
                repository.findByOrganizationIdAndProviderType(organizationId, providerType);
        if (existing.isEmpty()) return false;
        repository.delete(existing.get());
        log.info("ChannelManager connection deleted: org={} provider={}", organizationId, providerType);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<ChannelManagerConnection> getConnection(Long organizationId,
                                                              ChannelManagerProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long organizationId, ChannelManagerProviderType providerType) {
        return repository.findByOrganizationIdAndProviderType(organizationId, providerType)
                .map(c -> c.getStatus() == ChannelManagerConnection.Status.ACTIVE)
                .orElse(false);
    }

    public String decryptApiKey(ChannelManagerConnection conn) {
        return encryption.decrypt(conn.getApiKeyEncrypted());
    }
}
