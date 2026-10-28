package com.clenzy.integration.airbnb.service;

import com.clenzy.util.BaitlySecretDiagnostics;
import static com.clenzy.util.BaitlySecretDiagnostics.Operation.*;
import com.clenzy.util.BaitlySecretValueCodec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service de chiffrement/dechiffrement des tokens Airbnb en base.
 * Écrit le format configuré Baitly et lit aussi le format historique Jasypt.
 *
 * Les tokens OAuth (access_token, refresh_token) ne doivent JAMAIS
 * etre stockes en clair dans la base de donnees.
 */
@Service
public class AirbnbTokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbTokenEncryptionService.class);

    private final BaitlySecretValueCodec encryptor;

    @org.springframework.beans.factory.annotation.Autowired
    public AirbnbTokenEncryptionService(BaitlySecretValueCodec codec) { this.encryptor=codec; }

    public AirbnbTokenEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword) {
        this.encryptor = new BaitlySecretValueCodec(encryptorPassword,1,"","",false);
    }

    /**
     * Chiffre un token avant stockage en base.
     */
    public String encrypt(String plainToken) {
        if (plainToken == null || plainToken.isEmpty()) {
            return null;
        }
        try {
            return encryptor.encrypt(plainToken);
        } catch (Exception e) {
            var safe = BaitlySecretDiagnostics.failure(ENCRYPT, e);
            log.error("Échec du chiffrement du jeton Airbnb", safe);
            throw safe;
        }
    }

    /**
     * Dechiffre un token stocke en base.
     */
    public String decrypt(String encryptedToken) {
        if (encryptedToken == null || encryptedToken.isEmpty()) {
            return null;
        }
        try {
            return encryptor.decrypt(encryptedToken);
        } catch (Exception e) {
            var safe = BaitlySecretDiagnostics.failure(DECRYPT, e);
            log.error("Échec du déchiffrement du jeton Airbnb", safe);
            throw safe;
        }
    }
}
