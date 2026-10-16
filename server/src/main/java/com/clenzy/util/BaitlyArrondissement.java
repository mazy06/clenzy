package com.clenzy.util;

import java.text.Normalizer;
import java.util.Locale;

/** Codes INSEE municipaux Baitly, identiques aux clés des contours Paris/Lyon/Marseille. */
public final class BaitlyArrondissement {
    private BaitlyArrondissement() {}

    /** Une valeur municipale inconnue ne devient jamais un département entier. */
    public static String normalize(String country, String department, String value) {
        if (value == null || value.isBlank()) return null;
        String raw = value.trim();
        if (country == null || !"FR".equalsIgnoreCase(country.trim())) return raw;
        String dept = department == null ? "" : department.trim();
        int maximum = switch (dept) { case "75" -> 20; case "69" -> 9; case "13" -> 16; default -> 0; };
        if (maximum == 0) return raw;
        String prefix = switch (dept) { case "75" -> "751"; case "69" -> "6938"; default -> "132"; };
        String postalPrefix = switch (dept) { case "75" -> "750"; case "69" -> "6900"; default -> "130"; };
        String number;
        if (raw.matches("[0-9]{5}") && (raw.startsWith(prefix) || raw.startsWith(postalPrefix))) {
            number = raw.substring(prefix.length());
        } else {
            String ordinal = Normalizer.normalize(raw.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
            if (!ordinal.matches("[0-9]{1,2}(?:er|e|eme)?")) return null;
            number = ordinal.replaceAll("[^0-9]", "");
        }
        int n = Integer.parseInt(number);
        if (n < 1 || n > maximum) return null;
        return prefix + ("69".equals(dept) ? Integer.toString(n) : String.format(Locale.ROOT, "%02d", n));
    }

    public static String requireValid(String country, String department, String value) {
        String normalized = normalize(country, department, value);
        if (value != null && !value.isBlank() && normalized == null)
            throw new IllegalArgumentException("Arrondissement invalide pour ce département");
        return normalized;
    }
}
