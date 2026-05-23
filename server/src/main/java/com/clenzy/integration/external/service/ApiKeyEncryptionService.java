package com.clenzy.integration.external.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service generique de chiffrement / dechiffrement d'API keys pour les
 * integrations external (Yousign, Universign, DocaPoste, Odoo, ...).
 *
 * Utilise Jasypt AES-256 (meme cle que les autres services : Airbnb,
 * Pennylane). La cle est lue depuis {@code jasypt.encryptor.password}.
 *
 * Les API keys ne doivent JAMAIS etre stockees en clair en base : une fuite
 * de la DB donnerait acces aux services externes de toutes les organisations.
 *
 * <h2>Pourquoi un service unique</h2>
 * Tous les providers API key utilisent le meme algorithme de chiffrement.
 * Au lieu de dupliquer la logique (un encryption service par provider),
 * on factorise dans un service partage. Single Responsibility Principle :
 * cette classe a une seule raison de changer (l'algorithme de chiffrement).
 */
@Service
public class ApiKeyEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyEncryptionService.class);

    private final AES256TextEncryptor encryptor;

    public ApiKeyEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword) {
        this.encryptor = new AES256TextEncryptor();
        this.encryptor.setPassword(encryptorPassword);
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isEmpty()) {
            return plain;
        }
        try {
            return encryptor.encrypt(plain);
        } catch (Exception e) {
            log.error("API key encryption failed: {}", e.getMessage());
            throw new IllegalStateException("API key encryption failed", e);
        }
    }

    public String decrypt(String encrypted) {
        if (encrypted == null || encrypted.isEmpty()) {
            return encrypted;
        }
        try {
            return encryptor.decrypt(encrypted);
        } catch (Exception e) {
            log.error("API key decryption failed: {}", e.getMessage());
            throw new IllegalStateException("API key decryption failed", e);
        }
    }
}
