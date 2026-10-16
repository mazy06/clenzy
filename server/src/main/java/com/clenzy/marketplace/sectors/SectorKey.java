package com.clenzy.marketplace.sectors;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Clé d'un contour de secteur dans {@code geo/baitly-sectors.geojson}.
 *
 * <p>Même règle que {@code scripts/maps/sectors/sectorCities.mjs}, qui produit le fichier :
 * un arrondissement (code INSEE) prime sur sa ville, qui prime sur son département ; la ville est
 * normalisée (sans accents, minuscules, tirets) pour accepter « Fès » comme « Fes ».</p>
 */
public final class SectorKey {

    private SectorKey() {
    }

    /** Clé du secteur déclaré, ou {@code null} si la zone ne nomme rien de dessinable. */
    public static String of(String country, String department, String arrondissement, String city) {
        if ("FR".equalsIgnoreCase(country == null ? "" : country.trim())) {
            if (!blank(arrondissement)) {
                String code = com.clenzy.util.BaitlyArrondissement.normalize(country,department,arrondissement);
                return code == null ? null : "FR-A-" + code;
            }
            if (!blank(department)) {
                String dept = department.trim().toUpperCase(Locale.ROOT);
                return blank(city) ? "FR-D-" + dept : "FR-C-" + dept + "-" + normalizeCity(city);
            }
        }
        if (blank(country) || blank(city)) return null;
        return country.trim().toUpperCase(Locale.ROOT) + "-C-" + normalizeCity(city);
    }

    public static String normalizeCity(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replace("œ", "oe").replace("æ", "ae")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
