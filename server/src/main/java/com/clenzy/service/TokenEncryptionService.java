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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service partage de chiffrement/dechiffrement des tokens OAuth en base.
 *
 * Mode AES-256-GCM natif avec versionning des cles pour rotation.
 * Format: "GCMv{version}:{base64(iv+ciphertext)}"
 *
 * Support multi-cles :
 * - Cle courante (version N) pour le chiffrement
 * - Cles precedentes (version N-1, N-2...) pour le dechiffrement migration
 * - Legacy Jasypt (AES-CBC) en dernier fallback
 *
 * Configuration :
 *   clenzy.encryption.key-version=1         (version courante)
 *   clenzy.encryption.previous-passwords=   (mots de passe precedents, separes par virgule)
 *
 * Reutilise par : Airbnb, Minut, Tuya.
 */
@Service
public class TokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(TokenEncryptionService.class);

    private static final String AES_GCM_ALGO = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;    // 96 bits (NIST recommended)
    private static final int GCM_TAG_LENGTH = 128;   // 128 bits tag
    private static final String GCM_PREFIX = "GCM:";  // Legacy GCM prefix (v1 implicit)
    private static final String GCM_VERSIONED_PREFIX = "GCMv";  // Versioned: "GCMv2:..."

    private final int currentKeyVersion;
    private final SecretKey currentKey;
    private final Map<Integer, SecretKey> keyRing = new ConcurrentHashMap<>();
    private final AES256TextEncryptor legacyEncryptor;
    private final SecureRandom secureRandom = new SecureRandom();

    public TokenEncryptionService(
            @Value("${jasypt.encryptor.password}") String encryptorPassword,
            @Value("${clenzy.encryption.key-version:1}") int keyVersion,
            @Value("${clenzy.encryption.previous-passwords:}") String previousPasswords) {

        this.currentKeyVersion = keyVersion;
        this.currentKey = deriveKey(encryptorPassword);
        this.keyRing.put(keyVersion, currentKey);

        // Register previous key versions for decryption during rotation
        if (previousPasswords != null && !previousPasswords.isBlank()) {
            String[] parts = previousPasswords.split(",");
            for (int i = 0; i < parts.length; i++) {
                String prevPwd = parts[i].trim();
                if (!prevPwd.isEmpty()) {
                    int version = keyVersion - (i + 1);
                    if (version > 0) {
                        keyRing.put(version, deriveKey(prevPwd));
                        log.info("Cle de rotation enregistree pour la version {}", version);
                    }
                }
            }
        }

        // Keep legacy Jasypt encryptor for backward compatibility
        this.legacyEncryptor = new AES256TextEncryptor();
        this.legacyEncryptor.setPassword(encryptorPassword);

        log.info("TokenEncryptionService initialise — version courante: v{}, {} cle(s) dans le key ring",
                currentKeyVersion, keyRing.size());
    }

    /**
     * Chiffre un token en AES-256-GCM avec la cle courante.
     * Format: "GCMv{version}:{base64(iv+ciphertext)}"
     */
    public String encrypt(String plainToken) {
        if (plainToken == null || plainToken.isEmpty()) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(AES_GCM_ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, currentKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plainToken.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return GCM_VERSIONED_PREFIX + currentKeyVersion + ":" + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Erreur lors du chiffrement AES-GCM du token: {}", e.getMessage());
            throw new RuntimeException("Impossible de chiffrer le token", e);
        }
    }

    /**
     * Dechiffre un token stocke en base.
     * Supporte: GCMv{n} (versioned), GCM: (legacy v1), Jasypt (fallback).
     */
    public String decrypt(String encryptedToken) {
        if (encryptedToken == null || encryptedToken.isEmpty()) {
            return null;
        }

        // Format versioned: "GCMv2:base64..."
        if (encryptedToken.startsWith(GCM_VERSIONED_PREFIX)) {
            int colonIdx = encryptedToken.indexOf(':');
            if (colonIdx > GCM_VERSIONED_PREFIX.length()) {
                int version = Integer.parseInt(
                        encryptedToken.substring(GCM_VERSIONED_PREFIX.length(), colonIdx));
                String base64Data = encryptedToken.substring(colonIdx + 1);
                SecretKey key = keyRing.get(version);
                if (key == null) {
                    throw new RuntimeException("Cle non trouvee pour la version " + version
                            + ". Configurez clenzy.encryption.previous-passwords.");
                }
                return decryptGcm(base64Data, key);
            }
        }

        // Legacy GCM format (v1 implicit): "GCM:base64..."
        if (encryptedToken.startsWith(GCM_PREFIX)) {
            SecretKey v1Key = keyRing.getOrDefault(1, currentKey);
            return decryptGcm(encryptedToken.substring(GCM_PREFIX.length()), v1Key);
        }

        // Legacy Jasypt (AES-CBC) fallback
        try {
            String decrypted = legacyEncryptor.decrypt(encryptedToken);
            log.debug("Token dechiffre via Jasypt legacy — a migrer vers AES-GCM v{}", currentKeyVersion);
            return decrypted;
        } catch (Exception e) {
            log.error("Erreur lors du dechiffrement du token (ni GCM versioned, ni GCM legacy, ni Jasypt): {}",
                    e.getMessage());
            throw new RuntimeException("Impossible de dechiffrer le token", e);
        }
    }

    /**
     * Verifie si un token utilise la cle courante.
     * Retourne false pour les tokens legacy (Jasypt, GCM v1) ou d'anciennes versions.
     */
    public boolean isCurrentVersion(String encryptedToken) {
        if (encryptedToken == null) return false;
        return encryptedToken.startsWith(GCM_VERSIONED_PREFIX + currentKeyVersion + ":");
    }

    /**
     * Verifie si un token utilise l'ancien format Jasypt.
     */
    public boolean isLegacyFormat(String encryptedToken) {
        return encryptedToken != null
                && !encryptedToken.startsWith(GCM_PREFIX)
                && !encryptedToken.startsWith(GCM_VERSIONED_PREFIX);
    }

    /**
     * Re-chiffre un token avec la cle courante.
     * Utile pour les jobs de migration/rotation.
     */
    public String reEncrypt(String encryptedToken) {
        String plain = decrypt(encryptedToken);
        return encrypt(plain);
    }

    /**
     * Retourne la version de cle courante.
     */
    public int getCurrentKeyVersion() {
        return currentKeyVersion;
    }

    private String decryptGcm(String base64Data, SecretKey key) {
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
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
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
