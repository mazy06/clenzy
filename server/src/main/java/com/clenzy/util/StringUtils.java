package com.clenzy.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Utilitaires texte partages entre les services email/contact.
 */
public final class StringUtils {

    private StringUtils() {}

    /**
     * Retourne la premiere valeur non-null et non-blank, ou "" si aucune.
     */
    public static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    /**
     * Nettoie un nom de fichier : supprime les chemins, les caracteres speciaux.
     */
    public static String sanitizeFileName(String fileName) {
        String safe = firstNonBlank(fileName, "attachment");
        String normalized = safe.replace("\\", "/");
        int index = normalized.lastIndexOf('/');
        if (index >= 0) {
            normalized = normalized.substring(index + 1);
        }
        normalized = normalized.replaceAll("[\\r\\n\\t]", "_").trim();
        return normalized.isBlank() ? "attachment" : normalized;
    }

    /**
     * Echappe les caracteres HTML pour eviter les injections XSS.
     */
    public static String escapeHtml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /**
     * Calcule le hash SHA-256 d'un email normalise (lowercase + trim).
     * Utilise pour le lookup d'utilisateurs par email chiffre.
     */
    public static String computeEmailHash(String email) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(email.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 non disponible", e);
        }
    }
}
