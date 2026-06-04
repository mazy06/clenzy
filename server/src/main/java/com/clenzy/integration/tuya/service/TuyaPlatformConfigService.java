package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.model.TuyaPlatformConfig;
import com.clenzy.integration.tuya.repository.TuyaPlatformConfigRepository;
import com.clenzy.service.TokenEncryptionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Charge / enregistre les credentials du projet Tuya Cloud stockes en base (editables depuis l'UI).
 * Le secret est chiffre via {@link TokenEncryptionService}. Cache memoire (invalide a la sauvegarde)
 * pour eviter une requete + dechiffrement a chaque appel signe vers Tuya.
 */
@Service
public class TuyaPlatformConfigService {

    private final TuyaPlatformConfigRepository repository;
    private final TokenEncryptionService encryptionService;

    /** Cache des credentials resolus (secret dechiffre). Null tant que non charge / si absent. */
    private volatile Creds cached;
    private volatile boolean loaded;

    private record Creds(String accessId, String accessSecret, String baseUrl, String region) {}

    public TuyaPlatformConfigService(TuyaPlatformConfigRepository repository,
                                     TokenEncryptionService encryptionService) {
        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    private Creds current() {
        if (!loaded) {
            synchronized (this) {
                if (!loaded) {
                    cached = repository.findFirstByOrderByIdAsc().map(this::toCreds).orElse(null);
                    loaded = true;
                }
            }
        }
        return cached;
    }

    private Creds toCreds(TuyaPlatformConfig c) {
        String secret = c.getAccessSecretEncrypted() == null || c.getAccessSecretEncrypted().isBlank()
                ? null : encryptionService.decrypt(c.getAccessSecretEncrypted());
        return new Creds(c.getAccessId(), secret, c.getBaseUrl(), c.getRegion());
    }

    public String getAccessId() { Creds c = current(); return c == null ? null : c.accessId(); }
    public String getAccessSecret() { Creds c = current(); return c == null ? null : c.accessSecret(); }
    public String getApiBaseUrl() { Creds c = current(); return c == null ? null : c.baseUrl(); }
    public String getRegion() { Creds c = current(); return c == null ? null : c.region(); }

    public boolean isConfigured() {
        Creds c = current();
        return c != null && c.accessId() != null && !c.accessId().isBlank()
                && c.accessSecret() != null && !c.accessSecret().isBlank();
    }

    /** Enregistre (upsert du singleton). Si {@code accessSecret} vide, conserve le secret existant. */
    @Transactional
    public void save(String accessId, String accessSecret, String baseUrl, String region, String updatedBy) {
        TuyaPlatformConfig c = repository.findFirstByOrderByIdAsc().orElseGet(TuyaPlatformConfig::new);
        c.setAccessId(accessId == null ? null : accessId.trim());
        if (accessSecret != null && !accessSecret.isBlank()) {
            c.setAccessSecretEncrypted(encryptionService.encrypt(accessSecret.trim()));
        }
        if (baseUrl != null && !baseUrl.isBlank()) c.setBaseUrl(baseUrl.trim());
        if (region != null && !region.isBlank()) c.setRegion(region.trim());
        c.setUpdatedBy(updatedBy);
        repository.save(c);
        synchronized (this) { this.cached = toCreds(c); this.loaded = true; } // rafraichit le cache
    }
}
