package com.clenzy.booking.service;

import com.clenzy.service.SearchCacheInvalidator;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Component;

/**
 * Invalidation des caches de recherche du booking engine sur changement de DISPONIBILITÉ ou de PRIX.
 *
 * Sans ça, le calendrier agrégé des prix (« à partir de » par jour) et le détail propriété resteraient
 * servis depuis le cache jusqu'à l'expiration du TTL (10 min) après une réservation, un blocage ou un
 * changement de tarif. Composant DÉDIÉ (SRP) appelé par les points de mutation centraux (CalendarEngine,
 * RateOverrideService) → le cœur ne connaît pas les noms de cache booking-engine, il appelle juste une
 * méthode sémantique passant par le proxy Spring (@CacheEvict).
 */
@Component
public class BookingEngineSearchCacheEvictor implements SearchCacheInvalidator {

    /**
     * Vide le calendrier agrégé des prix + le détail propriété (toutes entrées). Éviction grossière mais
     * sûre : ces caches sont petits + bornés (TTL 10 min), comme l'éviction du cache propriété sur
     * changement de profil hôte (cf. BookingEngineChannelAdapter).
     */
    @Override
    @Caching(evict = {
        @CacheEvict(value = "booking-engine-price-calendar", allEntries = true),
        @CacheEvict(value = "booking-engine-properties", allEntries = true),
    })
    public void onAvailabilityOrPriceChanged() {
        // no-op : le travail d'éviction est fait par @CacheEvict via le proxy Spring.
    }
}
