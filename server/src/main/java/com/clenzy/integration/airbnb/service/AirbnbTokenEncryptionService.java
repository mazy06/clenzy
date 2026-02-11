package com.clenzy.integration.airbnb.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service de chiffrement/dechiffrement des tokens Airbnb en base.
 * Utilise AES-256 via Jasypt.
 *
 * Les tokens OAuth (access_token, refresh_token) ne doivent JAMAIS
 * etre stockes en clair dans la base de donnees.
 */
@Service
public class AirbnbTokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbTokenEncryptionService.class);

    private final AES256TextEncryptor encryptor;

    public AirbnbTokenEncryptionService(
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
