package com.clenzy.integration.oauth;

import java.math.BigDecimal;
import java.util.Map;

/** Valide la réponse complète avant de modifier les identifiants d'une connexion Baitly. */
public record BaitlyOAuthTokenResponse(String accessToken, String refreshToken, Integer expiresIn) {
    public static BaitlyOAuthTokenResponse parse(Map<String, Object> body, Integer defaultExpiry) {
        if (body == null || body.containsKey("error")) {
            throw invalid();
        }
        String access = token(body.get("access_token"), true);
        String refresh = token(body.get("refresh_token"), false);
        Integer expiry = defaultExpiry;
        Object rawExpiry = body.get("expires_in");
        if (rawExpiry != null) {
            if (!(rawExpiry instanceof Number)) {
                throw invalid();
            }
            try {
                expiry = new BigDecimal(rawExpiry.toString()).intValueExact();
            } catch (ArithmeticException | NumberFormatException ignored) {
                // Ne jamais propager la valeur reçue ni la cause du parseur.
                throw invalid();
            }
            if (expiry <= 0) {
                throw invalid();
            }
        }
        return new BaitlyOAuthTokenResponse(access, refresh, expiry);
    }

    private static String token(Object value, boolean required) {
        if (value == null && !required) {
            return null;
        }
        if (!(value instanceof String text) || text.isBlank()) {
            throw invalid();
        }
        return text;
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Réponse OAuth inutilisable ; reconnexion requise");
    }

    /** Empêche le toString généré d'exposer les jetons dans les diagnostics. */
    @Override
    public String toString() {
        return "BaitlyOAuthTokenResponse[redacted]";
    }
}
