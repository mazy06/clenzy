package com.clenzy.integration.odoo.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Chiffrement / dechiffrement des API keys Odoo en base.
 * Pattern identique a AirbnbTokenEncryptionService (Jasypt AES-256).
 *
 * Les API keys ne doivent JAMAIS etre stockees en clair :
 * une fuite de la base donnerait acces total a l'instance Odoo
 * de l'organisation.
 */
@Service
public class OdooApiKeyEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(OdooApiKeyEncryptionService.class);

    private final AES256TextEncryptor encryptor;

    public OdooApiKeyEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword) {
        this.encryptor = new AES256TextEncryptor();
        this.encryptor.setPassword(encryptorPassword);
    }

    public String encrypt(String plainApiKey) {
        if (plainApiKey == null || plainApiKey.isEmpty()) {
            return plainApiKey;
        }
        try {
            return encryptor.encrypt(plainApiKey);
        } catch (Exception e) {
            log.error("Failed to encrypt Odoo API key: {}", e.getMessage());
            throw new IllegalStateException("Odoo API key encryption failed", e);
        }
    }

    public String decrypt(String encryptedApiKey) {
        if (encryptedApiKey == null || encryptedApiKey.isEmpty()) {
            return encryptedApiKey;
        }
        try {
            return encryptor.decrypt(encryptedApiKey);
        } catch (Exception e) {
            log.error("Failed to decrypt Odoo API key: {}", e.getMessage());
            throw new IllegalStateException("Odoo API key decryption failed", e);
        }
    }
}
