package com.clenzy.integration.channel.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service de chiffrement/dechiffrement generique pour les credentials des channels.
 * Utilise AES-256 via Jasypt avec la meme cle que AirbnbTokenEncryptionService.
 *
 * Tous les credentials (API keys, mots de passe, tokens) sont chiffres
 * avant stockage en base de donnees.
 */
@Service
public class CredentialEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(CredentialEncryptionService.class);

    private final AES256TextEncryptor encryptor;

    public CredentialEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword) {
        this.encryptor = new AES256TextEncryptor();
        this.encryptor.setPassword(encryptorPassword);
    }

    /**
     * Chiffre une valeur avant stockage en base.
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return null;
        }
        try {
            return encryptor.encrypt(plainText);
        } catch (Exception e) {
            log.error("Erreur lors du chiffrement: {}", e.getMessage());
            throw new RuntimeException("Impossible de chiffrer la valeur", e);
        }
    }

    /**
     * Dechiffre une valeur stockee en base.
     */
    public String decrypt(String cipherText) {
        if (cipherText == null || cipherText.isEmpty()) {
            return null;
        }
        try {
            return encryptor.decrypt(cipherText);
        } catch (Exception e) {
            log.error("Erreur lors du dechiffrement: {}", e.getMessage());
            throw new RuntimeException("Impossible de dechiffrer la valeur", e);
        }
    }
}
