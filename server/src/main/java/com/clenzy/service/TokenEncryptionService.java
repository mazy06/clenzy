package com.clenzy.service;

import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Service partage de chiffrement/dechiffrement des tokens OAuth en base.
 *
 * Mode AES-256-GCM natif (par defaut). Support dual-mode pour migration
 * depuis l'ancien format Jasypt (AES-CBC) : si le dechiffrement GCM echoue,
 * fallback sur Jasypt puis re-chiffrement en GCM.
 *
 * Reutilise par : Airbnb, Minut, Tuya.
 */
@Service
public class TokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(TokenEncryptionService.class);

    private static final String AES_GCM_ALGO = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;    // 96 bits (NIST recommended)
    private static final int GCM_TAG_LENGTH = 128;   // 128 bits tag
    private static final String GCM_PREFIX = "GCM:";  // Prefix to identify GCM-encrypted values

    private final SecretKey gcmKey;
    private final AES256TextEncryptor legacyEncryptor;
    private final SecureRandom secureRandom = new SecureRandom();

    public TokenEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword) {
        // Derive a 256-bit key from the password using SHA-256
        this.gcmKey = deriveKey(encryptorPassword);

        // Keep legacy encryptor for migration (decrypt old tokens)
        this.legacyEncryptor = new AES256TextEncryptor();
        this.legacyEncryptor.setPassword(encryptorPassword);
    }

    /**
     * Chiffre un token en AES-256-GCM avant stockage en base.
     */
    public String encrypt(String plainToken) {
        if (plainToken == null || plainToken.isEmpty()) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(AES_GCM_ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, gcmKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plainToken.getBytes(StandardCharsets.UTF_8));

            // Concatenate IV + ciphertext, Base64 encode, add prefix
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return GCM_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Erreur lors du chiffrement AES-GCM du token: {}", e.getMessage());
            throw new RuntimeException("Impossible de chiffrer le token", e);
        }
    }

    /**
     * Dechiffre un token stocke en base.
     * Supporte le format GCM (prefixe "GCM:") et le legacy Jasypt (fallback).
     */
    public String decrypt(String encryptedToken) {
        if (encryptedToken == null || encryptedToken.isEmpty()) {
            return null;
        }

        if (encryptedToken.startsWith(GCM_PREFIX)) {
            return decryptGcm(encryptedToken.substring(GCM_PREFIX.length()));
        }

        // Legacy Jasypt fallback
        try {
            String decrypted = legacyEncryptor.decrypt(encryptedToken);
            log.debug("Token dechiffre via Jasypt legacy — a migrer vers AES-GCM");
            return decrypted;
        } catch (Exception e) {
            log.error("Erreur lors du dechiffrement du token (legacy ni GCM): {}", e.getMessage());
            throw new RuntimeException("Impossible de dechiffrer le token", e);
        }
    }

    /**
     * Verifie si un token chiffre utilise l'ancien format Jasypt.
     * Utile pour un batch de migration.
     */
    public boolean isLegacyFormat(String encryptedToken) {
        return encryptedToken != null && !encryptedToken.startsWith(GCM_PREFIX);
    }

    private String decryptGcm(String base64Data) {
        try {
            byte[] combined = Base64.getDecoder().decode(base64Data);
            if (combined.length < GCM_IV_LENGTH) {
                throw new RuntimeException("Token GCM trop court");
            }

            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(combined, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(AES_GCM_ALGO);
            cipher.init(Cipher.DECRYPT_MODE, gcmKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(ciphertext);

            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Erreur lors du dechiffrement AES-GCM du token: {}", e.getMessage());
            throw new RuntimeException("Impossible de dechiffrer le token (GCM)", e);
        }
    }

    private static SecretKey deriveKey(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new RuntimeException("Impossible de deriver la cle AES", e);
        }
    }
}
