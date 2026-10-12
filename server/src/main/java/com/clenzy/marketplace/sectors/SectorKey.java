package com.clenzy.marketplace.sectors;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Clé d'un contour de secteur dans {@code geo/baitly-sectors.geojson}.
 *
 * <p>Même règle que {@code scripts/maps/sectors/sectorCities.mjs}, qui produit le fichier :
 * un arrondissement (code INSEE) prime sur son département ; hors France, la ville est
 * normalisée (sans accents, minuscules, tirets) pour accepter « Fès » comme « Fes ».</p>
 */
public final class SectorKey {

    private SectorKey() {
    }

    /** Clé du secteur déclaré, ou {@code null} si la zone ne nomme rien de dessinable. */
    public static String of(String country, String department, String arrondissement, String city) {
        if (!blank(arrondissement)) return "FR-A-" + arrondissement.trim();
        if (!blank(department)) return "FR-D-" + department.trim().toUpperCase(Locale.ROOT);
        if (blank(country) || blank(city)) return null;
        return country.trim().toUpperCase(Locale.ROOT) + "-C-" + normalizeCity(city);
    }

    public static String normalizeCity(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
