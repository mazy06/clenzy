package com.clenzy.util;

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
}
