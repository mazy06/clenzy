package com.clenzy.util;

/**
 * Masquage de PII (email, nom complet) pour les logs applicatifs.
 *
 * <p>Les logs prod sont centralises (JSON → Loki/ELK) et ne sont pas couverts
 * par les politiques RGPD de retention/effacement des donnees personnelles :
 * aucun email ni nom complet ne doit y figurer en clair. Ces helpers gardent
 * juste assez d'information pour le debugging (premiere lettre + domaine,
 * initiales) sans identifier directement la personne.</p>
 */
public final class PiiMasker {

    private static final String MASKED = "***";

    private PiiMasker() { /* util class */ }

    /**
     * Masque la partie locale d'un email : {@code toufik@domaine.fr} →
     * {@code t***@domaine.fr}. Entree null/blank ou sans partie locale → {@code ***}.
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return MASKED;
        }
        String trimmed = email.trim();
        int at = trimmed.indexOf('@');
        if (at <= 0) {
            return MASKED;
        }
        return trimmed.charAt(0) + MASKED + trimmed.substring(at);
    }

    /**
     * Reduit un nom complet a ses initiales : {@code Jean Dupont} → {@code J.D.}.
     * Entree null/blank → {@code ***}.
     */
    public static String maskName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return MASKED;
        }
        StringBuilder initials = new StringBuilder();
        for (String part : fullName.trim().split("[\\s\\-]+")) {
            if (!part.isEmpty()) {
                initials.append(Character.toUpperCase(part.charAt(0))).append('.');
            }
        }
        return initials.isEmpty() ? MASKED : initials.toString();
    }
}
