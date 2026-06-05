package com.clenzy.integration.netatmo.service;

import com.clenzy.dto.netatmo.UpdateNetatmoConfigDto;
import com.clenzy.integration.netatmo.model.NetatmoPlatformConfig;
import com.clenzy.integration.netatmo.repository.NetatmoPlatformConfigRepository;
import com.clenzy.service.TokenEncryptionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Charge / enregistre les credentials de l'app Netatmo stockes en base (editables depuis l'UI).
 * Le client_secret est chiffre via {@link TokenEncryptionService}. Cache memoire (invalide a la
 * sauvegarde) pour eviter une requete + dechiffrement a chaque appel OAuth. Meme pattern que
 * {@code TuyaPlatformConfigService}.
 */
@Service
public class NetatmoPlatformConfigService {

    private final NetatmoPlatformConfigRepository repository;
    private final TokenEncryptionService encryptionService;

    private volatile Creds cached;
    private volatile boolean loaded;

    private record Creds(String clientId, String clientSecret, String redirectUri) {}

    public NetatmoPlatformConfigService(NetatmoPlatformConfigRepository repository,
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

    private Creds toCreds(NetatmoPlatformConfig c) {
        String secret = c.getClientSecretEncrypted() == null || c.getClientSecretEncrypted().isBlank()
                ? null : encryptionService.decrypt(c.getClientSecretEncrypted());
        return new Creds(c.getClientId(), secret, c.getRedirectUri());
    }

    public String getClientId() { Creds c = current(); return c == null ? null : c.clientId(); }
    public String getClientSecret() { Creds c = current(); return c == null ? null : c.clientSecret(); }
    public String getRedirectUri() { Creds c = current(); return c == null ? null : c.redirectUri(); }

    public boolean isConfigured() {
        Creds c = current();
        return c != null
                && c.clientId() != null && !c.clientId().isBlank()
                && c.clientSecret() != null && !c.clientSecret().isBlank()
                && c.redirectUri() != null && !c.redirectUri().isBlank();
    }

    /** Enregistre (upsert du singleton). Secret vide = inchange (conserve l'existant). */
    @Transactional
    public void save(UpdateNetatmoConfigDto dto, String updatedBy) {
        NetatmoPlatformConfig c = repository.findFirstByOrderByIdAsc().orElseGet(NetatmoPlatformConfig::new);
        c.setClientId(dto.clientId() == null ? null : dto.clientId().trim());
        if (notBlank(dto.clientSecret())) {
            c.setClientSecretEncrypted(encryptionService.encrypt(dto.clientSecret().trim()));
        }
        if (notBlank(dto.redirectUri())) c.setRedirectUri(dto.redirectUri().trim());
        c.setUpdatedBy(updatedBy);
        repository.save(c);
        synchronized (this) { this.cached = toCreds(c); this.loaded = true; }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
