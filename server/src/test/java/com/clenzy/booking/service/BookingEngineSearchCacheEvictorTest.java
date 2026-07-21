package com.clenzy.booking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Garde-fou du câblage d'invalidation : un changement de prix/dispo doit vider TOUS les caches
 * publics du booking engine — calendrier agrégé, détail propriété ET listing/facettes de
 * recherche ({@code booking-engine-search}). Retirer une entrée de la liste laisserait des
 * prix/disponibilités périmés servis aux widgets jusqu'à expiration du TTL.
 */
@DisplayName("BookingEngineSearchCacheEvictor")
class BookingEngineSearchCacheEvictorTest {

    @Test
    @DisplayName("onAvailabilityOrPriceChanged évince price-calendar + properties + search (allEntries)")
    void evictsAllBookingEngineCaches() throws NoSuchMethodException {
        Method m = BookingEngineSearchCacheEvictor.class.getMethod("onAvailabilityOrPriceChanged");
        Caching caching = m.getAnnotation(Caching.class);
        assertThat(caching).isNotNull();

        List<String> evictedCaches = Arrays.stream(caching.evict())
            .flatMap(evict -> Arrays.stream(evict.value()))
            .toList();
        assertThat(evictedCaches).containsExactlyInAnyOrder(
            "booking-engine-price-calendar",
            "booking-engine-properties",
            "booking-engine-search");

        assertThat(Arrays.stream(caching.evict()).allMatch(CacheEvict::allEntries))
            .as("éviction grossière mais sûre : allEntries sur chaque cache")
            .isTrue();
    }
}
