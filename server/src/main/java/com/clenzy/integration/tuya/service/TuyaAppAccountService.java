package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.model.TuyaAppAccount;
import com.clenzy.integration.tuya.repository.TuyaAppAccountRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/**
 * Gere le compte app Tuya d'un hote (modele C) : le provisionne a la demande (1 par hote, sous le
 * schema du projet plateforme) et fournit ses identifiants au mobile pour la connexion SDK avant
 * l'appairage. Une fois l'hote connecte avec ce compte dans l'app, les appareils qu'il appaire
 * atterrissent sur le projet plateforme et sont decouvrables par le PMS (segmentes par le claim).
 */
@Service
public class TuyaAppAccountService {

    private static final Logger log = LoggerFactory.getLogger(TuyaAppAccountService.class);

    private final TuyaAppAccountRepository repository;
    private final TuyaApiService apiService;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;
    private final SecureRandom secureRandom = new SecureRandom();

    public TuyaAppAccountService(TuyaAppAccountRepository repository,
                                 TuyaApiService apiService,
                                 TokenEncryptionService encryptionService,
                                 TenantContext tenantContext) {
        this.repository = repository;
        this.apiService = apiService;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
    }

    /** Compte app Tuya de l'hote : le retourne s'il existe, sinon le provisionne. */
    @Transactional
    public TuyaAppAccount getOrCreate(String userId) {
        return repository.findByUserId(userId).orElseGet(() -> provision(userId));
    }

    /** Mot de passe en clair du compte (dechiffre) pour la connexion SDK mobile. */
    public String decryptSecret(TuyaAppAccount account) {
        return account.getTuyaSecretEncrypted() == null ? null
                : encryptionService.decrypt(account.getTuyaSecretEncrypted());
    }

    private TuyaAppAccount provision(String userId) {
        String username = "clenzy_" + userId.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        String password = randomSecret();
        String countryCode = "33"; // TODO deriver du pays de l'organisation / de l'hote
        Map<String, Object> resp = apiService.createAppUser(username, password, countryCode); // throws si schema absent

        TuyaAppAccount acc = new TuyaAppAccount();
        acc.setUserId(userId);
        acc.setOrganizationId(tenantContext.getRequiredOrganizationId());
        acc.setTuyaUid(extractUid(resp));
        acc.setTuyaUsername(username);
        acc.setTuyaSecretEncrypted(encryptionService.encrypt(password));
        acc.setCountryCode(countryCode);
        TuyaAppAccount saved = repository.save(acc);
        log.info("Compte app Tuya provisionne pour user {} (uid={})", userId, saved.getTuyaUid());
        return saved;
    }

    @SuppressWarnings("unchecked")
    private static String extractUid(Map<String, Object> resp) {
        Object result = resp == null ? null : resp.get("result");
        if (result instanceof Map<?, ?> m) {
            Object uid = ((Map<String, Object>) m).get("uid");
            return uid == null ? null : uid.toString();
        }
        return null;
    }

    private String randomSecret() {
        byte[] b = new byte[18];
        secureRandom.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
}
