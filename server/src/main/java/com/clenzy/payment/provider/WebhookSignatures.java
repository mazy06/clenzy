package com.clenzy.payment.provider;

/**
 * Comparaisons de signatures de webhook <strong>à temps constant</strong> (anti
 * timing-attack), partagées par les adaptateurs PSP régionaux.
 *
 * <p>Extrait de code dupliqué à l'identique dans PayZone / PayTabs / CMI
 * (Rule of Three) : centraliser une primitive de sécurité garantit une seule
 * implémentation à auditer et un comportement homogène.</p>
 *
 * <ul>
 *   <li>{@link #constantTimeEqualsIgnoreCase} — signatures HMAC en hexadécimal,
 *       comparées <b>sans tenir compte de la casse</b> (PayZone, PayTabs).</li>
 *   <li>{@link #constantTimeEquals} — hash <b>sensible à la casse</b> (CMI).</li>
 * </ul>
 *
 * <p>Les deux méthodes sont null-safe (retournent {@code false} si l'un des
 * opérandes est {@code null}) et ne court-circuitent pas sur la première
 * différence de caractère (durée indépendante du contenu, à longueur égale).</p>
 */
public final class WebhookSignatures {

    private WebhookSignatures() {
    }

    /** Comparaison à temps constant, insensible à la casse (HMAC hex : PayZone, PayTabs). */
    public static boolean constantTimeEqualsIgnoreCase(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return constantTimeEquals(a.toLowerCase(), b.toLowerCase());
    }

    /** Comparaison à temps constant, sensible à la casse (hash CMI). */
    public static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        if (a.length() != b.length()) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }
}
