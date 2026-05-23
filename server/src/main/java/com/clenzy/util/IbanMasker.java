package com.clenzy.util;

/**
 * Utilitaire de masquage d'IBAN partagé entre tous les endpoints qui exposent
 * un IBAN au frontend (jamais en clair).
 *
 * <h2>Format produit</h2>
 * <p>Préserve la longueur réelle de l'IBAN + le code pays + les 4 derniers
 * caractères, avec un découpage standard SEPA (espace tous les 4 chars) :</p>
 *
 * <ul>
 *   <li>FR (27 chars) : {@code FR76 **** **** **** **** *** 0189}</li>
 *   <li>MA (28 chars) : {@code MA64 **** **** **** **** **** 4921}</li>
 *   <li>SA (24 chars) : {@code SA03 **** **** **** **** 7519}</li>
 *   <li>DE (22 chars) : {@code DE89 **** **** **** ** 3000}</li>
 * </ul>
 *
 * <h2>Caractéristiques</h2>
 * <ul>
 *   <li>Suffixe (4 derniers chars) toujours intact comme groupe distinct</li>
 *   <li>Espacement tous les 4 chars dans le milieu (format ISO 13616 SEPA)</li>
 *   <li>Longueur réelle préservée (utile pour vérification visuelle)</li>
 *   <li>Frontend détecte la valeur "non modifiée" via la présence de {@code *}</li>
 * </ul>
 */
public final class IbanMasker {

    private IbanMasker() { /* util class */ }

    /**
     * Masque un IBAN. {@code null} si l'entrée est null ou trop courte.
     */
    public static String mask(String iban) {
        if (iban == null || iban.length() < 4) return null;
        if (iban.length() < 8) {
            return "****" + iban.substring(iban.length() - 4);
        }
        String prefix = iban.substring(0, 4);
        String suffix = iban.substring(iban.length() - 4);
        int middleLength = iban.length() - 8;

        StringBuilder middle = new StringBuilder();
        for (int i = 0; i < middleLength; i++) {
            if (i > 0 && i % 4 == 0) middle.append(' ');
            middle.append('*');
        }
        return prefix + " " + middle + " " + suffix;
    }
}
