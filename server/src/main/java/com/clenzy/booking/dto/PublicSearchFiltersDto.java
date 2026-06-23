package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Facettes de recherche du booking engine public : options disponibles pour construire l'UI de filtres
 * (types de logement, équipements, bornes de prix, capacités max). Calculées server-side sur l'ensemble
 * des propriétés VISIBLES de l'org (non filtrées), pour que le widget « Filtre » connaisse les choix
 * possibles indépendamment des résultats courants.
 *
 * Prix exprimés dans la devise des propriétés ({@code currency}) ; la conversion d'affichage est gérée
 * séparément côté résultats.
 */
public record PublicSearchFiltersDto(
    List<Facet> propertyTypes,
    List<Facet> amenities,
    BigDecimal priceMin,
    BigDecimal priceMax,
    int maxBedrooms,
    int maxBathrooms,
    int maxGuests,
    String currency
) {
    /** Une option de filtre + le nombre de propriétés concernées. */
    public record Facet(String code, int count) {}
}
