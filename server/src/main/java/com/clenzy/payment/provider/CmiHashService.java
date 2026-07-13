package com.clenzy.payment.provider;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Service de calcul du hash SHA-512 selon la specification CMI Maroc
 * (mode {@code hashAlgorithm=ver3}).
 *
 * <h2>Algorithme officiel CMI</h2>
 * <ol>
 *   <li>Trier tous les parametres par <strong>nom de champ</strong>
 *       (case-insensitive, ordre alphabetique).</li>
 *   <li>Exclure {@code HASH} et {@code encoding} du calcul (champs reserves).</li>
 *   <li>Echapper les caracteres speciaux dans chaque valeur :
 *       {@code |} -> {@code \|} et {@code \} -> {@code \\}.</li>
 *   <li>Joindre les valeurs echappees avec le separateur {@code |}.</li>
 *   <li>Concatener {@code "|" + escape(storeKey)} a la fin.</li>
 *   <li>Calculer SHA-512 sur les bytes UTF-8 → encoder en Base64 (standard).</li>
 * </ol>
 *
 * <h2>Pourquoi un service dedie</h2>
 * <p>Le hash est <strong>le point critique</strong> de l'integration CMI : un
 * mauvais ordre de champ, un escape oublie ou un encoding incorrect = paiement
 * rejete avec un message generique. Isoler le calcul dans un service permet
 * des tests unitaires precis avec des vecteurs de test connus, sans monter
 * tout le contexte du provider.</p>
 *
 * <p>Reference : <a href="https://www.cmi.co.ma/">CMI E-commerce documentation
 * — Hash Method ver3</a> (NDA sandbox).</p>
 */
@Component
public class CmiHashService {

    /** Champs explicitement exclus du calcul de hash selon la spec CMI. */
    private static final java.util.Set<String> HASH_EXCLUDED_FIELDS =
        java.util.Set.of("HASH", "encoding");

    /**
     * Calcule le hash CMI ver3 pour les parametres donnes.
     *
     * @param params parametres a hasher (les valeurs null sont traitees comme vides)
     * @param storeKey cle secrete du marchand CMI
     * @return hash SHA-512 encode en Base64 standard
     */
    public String computeHash(Map<String, String> params, String storeKey) {
        if (params == null) {
            throw new IllegalArgumentException("params must not be null");
        }
        if (storeKey == null || storeKey.isEmpty()) {
            throw new IllegalArgumentException("storeKey must not be null or empty");
        }

        // 1. Trier les params par nom de champ (case-insensitive).
        TreeMap<String, String> sorted = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        params.forEach((k, v) -> {
            if (k == null) return;
            if (HASH_EXCLUDED_FIELDS.contains(k)) return;
            // Comparaison case-insensitive aussi (HASH vs hash vs Hash)
            for (String excluded : HASH_EXCLUDED_FIELDS) {
                if (excluded.equalsIgnoreCase(k)) return;
            }
            sorted.put(k, v != null ? v : "");
        });

        // 2. Joindre les valeurs echappees avec "|".
        List<String> escapedValues = new ArrayList<>(sorted.size());
        for (String value : sorted.values()) {
            escapedValues.add(escape(value));
        }
        String hashPlaintext = String.join("|", escapedValues);

        // 3. Append "|" + escape(storeKey).
        hashPlaintext = hashPlaintext + "|" + escape(storeKey);

        // 4. SHA-512 → Base64.
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-512");
            byte[] sha = digest.digest(hashPlaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(sha);
        } catch (NoSuchAlgorithmException e) {
            // SHA-512 est garanti dans la JVM standard
            throw new IllegalStateException("SHA-512 algorithm not available", e);
        }
    }

    /**
     * Verifie qu'un hash recu (callback CMI) correspond aux params recus.
     *
     * @param params parametres recus dans le callback (inclus le champ HASH)
     * @param storeKey cle secrete du marchand
     * @return {@code true} si le hash est valide
     */
    public boolean verifyHash(Map<String, String> params, String storeKey) {
        if (params == null) return false;
        String receivedHash = params.get("HASH");
        if (receivedHash == null || receivedHash.isBlank()) return false;
        String computed = computeHash(params, storeKey);
        // Hash CMI sensible à la casse (base64/hex) → comparaison constant-time exacte.
        return WebhookSignatures.constantTimeEquals(computed, receivedHash.trim());
    }

    /**
     * Echappe une valeur selon la spec CMI : {@code \} -> {@code \\} puis
     * {@code |} -> {@code \|}. L'ordre est important pour ne pas double-echapper
     * les backslashes inseres par le 2e remplacement.
     */
    private static String escape(String value) {
        if (value == null) return "";
        return value
            .replace("\\", "\\\\")
            .replace("|", "\\|");
    }

    /** Comparaison constant-time pour eviter timing attacks sur la signature. */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        if (a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }

    /**
     * Helper : convertit un code ISO 4217 alpha (MAD, EUR) vers le code numerique
     * attendu par CMI dans le champ {@code currency}.
     *
     * @return code numerique (ex: "504" pour MAD, "978" pour EUR)
     */
    public static String toCmiCurrencyCode(String iso4217Alpha) {
        if (iso4217Alpha == null) return "504"; // default MAD
        return switch (iso4217Alpha.toUpperCase(Locale.ROOT)) {
            case "MAD" -> "504";
            case "EUR" -> "978";
            case "USD" -> "840";
            case "GBP" -> "826";
            default -> throw new IllegalArgumentException(
                "Currency not supported by CMI: " + iso4217Alpha);
        };
    }
}
