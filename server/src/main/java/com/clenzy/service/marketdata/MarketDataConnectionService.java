package com.clenzy.service.marketdata;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.model.MarketDataConnection;
import com.clenzy.repository.MarketDataConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Persistance + chiffrement des connexions fournisseurs de données de marché
 * (Airbtics, AirROI). Réutilise {@link ApiKeyEncryptionService} (Jasypt AES-256) :
 * la clé n'est jamais stockée ni renvoyée en clair. Portée plateforme —
 * l'activation d'une clé rend le provider {@code isConfigured()} au prochain
 * cycle d'ingestion, sans redéploiement.
 */
@Service
public class MarketDataConnectionService {

    private final MarketDataConnectionRepository repository;
    private final ApiKeyEncryptionService encryption;

    public MarketDataConnectionService(MarketDataConnectionRepository repository,
                                       ApiKeyEncryptionService encryption) {
        this.repository = repository;
        this.encryption = encryption;
    }

    @Transactional
    public MarketDataConnection saveConnection(MarketDataProviderType provider,
                                               String apiKey, String baseUrl) {
        final MarketDataConnection connection = repository.findByProvider(provider.name())
                .orElseGet(() -> new MarketDataConnection(provider.name(), null, null));
        connection.setApiKeyEncrypted(encryption.encrypt(apiKey));
        connection.setBaseUrl(baseUrl != null && !baseUrl.isBlank() ? baseUrl.trim() : null);
        connection.setEnabled(true);
        return repository.save(connection);
    }

    @Transactional(readOnly = true)
    public Optional<MarketDataConnection> getConnection(MarketDataProviderType provider) {
        return repository.findByProvider(provider.name());
    }

    /** Clé API déchiffrée d'un provider ACTIVÉ — vide sinon (provider dormant). */
    @Transactional(readOnly = true)
    public Optional<String> resolveApiKey(MarketDataProviderType provider) {
        return repository.findByProvider(provider.name())
                .filter(MarketDataConnection::isEnabled)
                .map(c -> encryption.decrypt(c.getApiKeyEncrypted()));
    }

    /** Base URL configurée d'un provider activé — vide = défaut du provider. */
    @Transactional(readOnly = true)
    public Optional<String> resolveBaseUrl(MarketDataProviderType provider) {
        return repository.findByProvider(provider.name())
                .filter(MarketDataConnection::isEnabled)
                .map(MarketDataConnection::getBaseUrl)
                .filter(url -> url != null && !url.isBlank());
    }

    @Transactional
    public boolean disconnect(MarketDataProviderType provider) {
        return repository.findByProvider(provider.name())
                .map(c -> {
                    repository.delete(c);
                    return true;
                })
                .orElse(false);
    }
}
