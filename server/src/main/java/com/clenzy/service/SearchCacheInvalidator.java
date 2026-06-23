package com.clenzy.service;

/**
 * Point d'extension (cœur) pour invalider les caches de recherche dépendant de la DISPONIBILITÉ ou des
 * PRIX. Implémenté par la couche booking (évince le calendrier agrégé des prix + le détail propriété).
 *
 * Inversion de dépendance : les services cœur (CalendarEngine, RateOverrideService) dépendent de CETTE
 * interface, pas du package `booking` → on respecte la règle de dépendance (le cœur ne connaît pas la
 * feature). Si aucune implémentation n'est présente, un no-op suffirait ; en pratique la couche booking
 * fournit toujours le bean.
 */
public interface SearchCacheInvalidator {
    /** À appeler après un changement de disponibilité (réservation, blocage…) ou de prix (override, tarif/jour). */
    void onAvailabilityOrPriceChanged();
}
