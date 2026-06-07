package com.clenzy.util;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber;

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
     * Echappe les caracteres reserves XML (& {@literal <} {@literal >} " ').
     *
     * <p>Utilise pour injecter des valeurs user-controlled (memoire long-terme,
     * snippets RAG, contexte UI) dans les balises XML d'un system prompt LLM —
     * empeche qu'un memoryValue contenant {@code </item><injected>...} ne
     * trompe le parseur du LLM ou n'injecte une instruction parasite.</p>
     *
     * <p>Difference avec {@link #escapeHtml(String)} : utilise l'entite nommee
     * {@code &apos;} (standard XML) au lieu de {@code &#39;} (decimal HTML).</p>
     */
    public static String escapeXml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
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

    /**
     * Normalise un numero de telephone au format E.164 (ex: +33612345678) via
     * libphonenumber. {@code defaultRegion} (code ISO pays, ex "FR") resout les
     * numeros nationaux (ex "0612..."). Les numeros prefixes "+" sont parses
     * sans region. Pour un numero international sans "+" (cas webhook Meta :
     * "33612..."), passer defaultRegion=null : on tente "+"+numero.
     *
     * @return le numero au format E.164, ou null si invalide/non parsable.
     */
    public static String normalizePhoneE164(String rawPhone, String defaultRegion) {
        if (rawPhone == null || rawPhone.isBlank()) return null;
        PhoneNumberUtil util = PhoneNumberUtil.getInstance();
        String input = rawPhone.trim();
        String region = (defaultRegion != null && !defaultRegion.isBlank())
            ? defaultRegion.trim().toUpperCase() : null;
        try {
            Phonenumber.PhoneNumber parsed;
            if (input.startsWith("+")) {
                parsed = util.parse(input, null);
            } else if (region != null) {
                parsed = util.parse(input, region);
            } else {
                parsed = util.parse("+" + input, null);
            }
            if (!util.isValidNumber(parsed)) return null;
            return util.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164);
        } catch (NumberParseException e) {
            return null;
        }
    }

    /**
     * Hash SHA-256 deterministe d'un numero de telephone, apres normalisation
     * E.164. Sert a retrouver un guest par son numero (chiffre en base, donc
     * non recherchable directement). Retourne null si le numero est invalide.
     */
    public static String computePhoneHash(String rawPhone, String defaultRegion) {
        String e164 = normalizePhoneE164(rawPhone, defaultRegion);
        if (e164 == null) return null;
        return sha256Hex(e164);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
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
