package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.dto.UpdateTuyaConfigDto;
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

    private record Creds(String accessId, String accessSecret, String baseUrl, String region, String appSchema,
                         String appKey, String appSecret) {}

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
        String appSecret = c.getAppSecretEncrypted() == null || c.getAppSecretEncrypted().isBlank()
                ? null : encryptionService.decrypt(c.getAppSecretEncrypted());
        return new Creds(c.getAccessId(), secret, c.getBaseUrl(), c.getRegion(), c.getAppSchema(),
                c.getAppKey(), appSecret);
    }

    public String getAccessId() { Creds c = current(); return c == null ? null : c.accessId(); }
    public String getAccessSecret() { Creds c = current(); return c == null ? null : c.accessSecret(); }
    public String getApiBaseUrl() { Creds c = current(); return c == null ? null : c.baseUrl(); }
    public String getRegion() { Creds c = current(); return c == null ? null : c.region(); }
    public String getAppSchema() { Creds c = current(); return c == null ? null : c.appSchema(); }
    public String getAppKey() { Creds c = current(); return c == null ? null : c.appKey(); }
    public String getAppSecret() { Creds c = current(); return c == null ? null : c.appSecret(); }

    public boolean isConfigured() {
        Creds c = current();
        return c != null && c.accessId() != null && !c.accessId().isBlank()
                && c.accessSecret() != null && !c.accessSecret().isBlank();
    }

    /** Enregistre (upsert du singleton). Secret/AppSecret vides = inchanges (conserve l'existant). */
    @Transactional
    public void save(UpdateTuyaConfigDto dto, String updatedBy) {
        TuyaPlatformConfig c = repository.findFirstByOrderByIdAsc().orElseGet(TuyaPlatformConfig::new);
        c.setAccessId(dto.accessId() == null ? null : dto.accessId().trim());
        if (notBlank(dto.accessSecret())) {
            c.setAccessSecretEncrypted(encryptionService.encrypt(dto.accessSecret().trim()));
        }
        if (notBlank(dto.baseUrl())) c.setBaseUrl(dto.baseUrl().trim());
        if (notBlank(dto.region())) c.setRegion(dto.region().trim());
        if (notBlank(dto.appSchema())) c.setAppSchema(dto.appSchema().trim());
        if (notBlank(dto.appKey())) c.setAppKey(dto.appKey().trim());
        if (notBlank(dto.appSecret())) {
            c.setAppSecretEncrypted(encryptionService.encrypt(dto.appSecret().trim()));
        }
        c.setUpdatedBy(updatedBy);
        repository.save(c);
        synchronized (this) { this.cached = toCreds(c); this.loaded = true; } // rafraichit le cache
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
