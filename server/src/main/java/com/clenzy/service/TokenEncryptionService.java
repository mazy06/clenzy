package com.clenzy.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service partage de chiffrement/dechiffrement des tokens OAuth en base.
 * Utilise AES-256 via Jasypt.
 *
 * Reutilise par : Airbnb, Minut, Tuya.
 */
@Service
public class TokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(TokenEncryptionService.class);

    private final AES256TextEncryptor encryptor;

    public TokenEncryptionService(
            @Value("${jasypt.encryptor.password:default-dev-key}") String encryptorPassword) {
        this.encryptor = new AES256TextEncryptor();
        this.encryptor.setPassword(encryptorPassword);
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
            log.error("Erreur lors du chiffrement du token: {}", e.getMessage());
            throw new RuntimeException("Impossible de chiffrer le token", e);
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
            log.error("Erreur lors du dechiffrement du token: {}", e.getMessage());
            throw new RuntimeException("Impossible de dechiffrer le token", e);
        }
    }
}
