package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Critères de recherche du booking engine public (filtrage SERVER-SIDE des propriétés).
 *
 * Le filtrage s'applique sur le {@link PublicPropertyDto} déjà mappé (org-scopé en amont). Montants en
 * BigDecimal comparés via {@code compareTo} (sensibilité au scale). Équipements : la propriété doit
 * porter TOUS les équipements demandés (ET logique), comparaison insensible à la casse.
 */
public record PropertySearchFilters(
    Set<String> types,
    BigDecimal minPrice,
    BigDecimal maxPrice,
    Integer minBedrooms,
    Integer minBathrooms,
    Integer minGuests,
    Set<String> amenities
) {
    /** Aucun filtre (listing complet). */
    public static final PropertySearchFilters NONE = of(null, null, null, null, null, null, null);

    /** Construit des filtres normalisés (listes nulles → ensembles vides), tolérant aux entrées absentes. */
    public static PropertySearchFilters of(
        List<String> types, BigDecimal minPrice, BigDecimal maxPrice,
        Integer minBedrooms, Integer minBathrooms, Integer minGuests, List<String> amenities
    ) {
        return new PropertySearchFilters(
            types == null ? Set.of() : new java.util.LinkedHashSet<>(types),
            minPrice, maxPrice, minBedrooms, minBathrooms, minGuests,
            amenities == null ? Set.of() : new java.util.LinkedHashSet<>(amenities)
        );
    }

    public boolean isEmpty() {
        return types.isEmpty() && minPrice == null && maxPrice == null
            && minBedrooms == null && minBathrooms == null && minGuests == null && amenities.isEmpty();
    }

    /** Vrai si la propriété satisfait TOUS les critères présents. */
    public boolean matches(PublicPropertyDto p) {
        if (!types.isEmpty() && (p.type() == null || types.stream().noneMatch(t -> t.equalsIgnoreCase(p.type())))) {
            return false;
        }
        if (minPrice != null && (p.priceFrom() == null || p.priceFrom().compareTo(minPrice) < 0)) {
            return false;
        }
        if (maxPrice != null && (p.priceFrom() == null || p.priceFrom().compareTo(maxPrice) > 0)) {
            return false;
        }
        if (minBedrooms != null && (p.bedroomCount() == null || p.bedroomCount() < minBedrooms)) {
            return false;
        }
        if (minBathrooms != null && (p.bathroomCount() == null || p.bathroomCount() < minBathrooms)) {
            return false;
        }
        if (minGuests != null && (p.maxGuests() == null || p.maxGuests() < minGuests)) {
            return false;
        }
        if (!amenities.isEmpty()) {
            List<String> owned = p.amenities() == null ? List.of() : p.amenities();
            for (String want : amenities) {
                if (owned.stream().noneMatch(a -> a.equalsIgnoreCase(want))) {
                    return false;
                }
            }
        }
        return true;
    }
}
