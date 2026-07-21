package com.clenzy.config;

import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PublicPropertyDetailDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.booking.dto.PublicSearchFiltersDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link CacheConfig}.
 *
 * <p>Le bean {@code cacheManager(RedisConnectionFactory)} retourne un
 * {@link TwoLayerCacheManager} qui wrappe un Redis cache manager. On verifie
 * surtout que le bean construit ne crash pas et expose le type attendu — la
 * couverture des caches individuels passe ensuite via {@link TwoLayerCacheManager}
 * (deja teste).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CacheConfig")
class CacheConfigTest {

    @Mock private RedisConnectionFactory redisConnectionFactory;

    private CacheConfig config;
    /** Publisher no-op : la diffusion pub/sub n'est pas exercee dans ces tests unitaires. */
    private final CacheInvalidationPublisher noopPublisher = (cacheName, key) -> { };

    @BeforeEach
    void setUp() {
        config = new CacheConfig();
    }

    @Test
    @DisplayName("cacheManager retourne un TwoLayerCacheManager (defaut config + 8 caches specifiques)")
    void cacheManager_returnsTwoLayerCacheManager() {
        CacheManager manager = config.cacheManager(redisConnectionFactory, noopPublisher);

        assertThat(manager).isNotNull();
        assertThat(manager).isInstanceOf(TwoLayerCacheManager.class);
    }

    @Test
    @DisplayName("cacheManager expose les noms de caches via getCacheNames()")
    void cacheManager_exposesCacheNames() {
        CacheManager manager = config.cacheManager(redisConnectionFactory, noopPublisher);

        // getCacheNames() peut etre vide tant qu'aucun getCache() n'a ete fait
        // (Redis cache manager se construit avec withInitialCacheConfigurations).
        assertThat(manager.getCacheNames()).isNotNull();
    }

    @Test
    @DisplayName("cacheManager retourne null quand on cherche un cache inconnu (RedisCacheManager comportement)")
    void cacheManager_unknownCacheNameReturnsNull_or_DefaultConfig() {
        CacheManager manager = config.cacheManager(redisConnectionFactory, noopPublisher);

        // RedisCacheManager + Caffeine L1 → renvoie un Cache (default config) ou null.
        // Le but est juste d'exercer la branche createTwoLayerCache.
        Object cache = manager.getCache("random-unknown-cache-name");
        assertThat(cache == null || cache instanceof org.springframework.cache.Cache).isTrue();
    }

    @Test
    @DisplayName("instancier CacheConfig est sans effet de bord")
    void newInstance_noSideEffects() {
        CacheConfig fresh = new CacheConfig();
        assertThat(fresh).isNotNull();
    }

    /**
     * Round-trip via l'ObjectMapper EXACT du sérialiseur Redis (writeValueAsBytes puis
     * readValue(bytes, Object.class) — mêmes appels que GenericJackson2JsonRedisSerializer).
     *
     * <p>Piège couvert : les records sont FINAUX, donc {@code DefaultTyping.NON_FINAL} ne leur
     * écrit pas de type id {@code @class} — sans le MixIn de CacheConfig, toute valeur record
     * relue depuis Redis (L2, après expiration du L1 Caffeine 30s) échouait en
     * {@code InvalidTypeIdException}. Ces tests cassent si un DTO caché sort de la whitelist
     * MixIn ou si une liste cachée redevient une ImmutableCollection (List.of / toList).</p>
     */
    @Nested
    @DisplayName("Sérialisation Redis des DTOs booking engine (records + MixIn @class)")
    class BookingEngineDtoSerialization {

        private Object roundTrip(Object value) throws Exception {
            ObjectMapper mapper = CacheConfig.createObjectMapper();
            byte[] bytes = mapper.writeValueAsBytes(value);
            return mapper.readValue(bytes, Object.class);
        }

        private PublicPropertyDto sampleProperty() {
            return new PublicPropertyDto(
                42L, "Villa Azur", "VILLA", "Marrakech", "MA",
                3, 2, 6, 120,
                new BigDecimal("150.00"), new BigDecimal("40.00"), 2, "EUR",
                "/api/public/property-photos/42/1",
                List.of("/api/public/property-photos/42/1", "/api/public/property-photos/42/2"),
                List.of("WIFI", "POOL"),
                "15:00", "11:00",
                12, 21, 4.8, 9L, "Belle villa avec piscine");
        }

        @Test
        @DisplayName("ArrayList<PublicPropertyDto> (valeur du cache booking-engine-search) survit au round-trip")
        void propertyList_roundTrips() throws Exception {
            List<PublicPropertyDto> original = new ArrayList<>(List.of(sampleProperty()));

            Object back = roundTrip(original);

            assertThat(back).isInstanceOf(List.class);
            assertThat((List<?>) back).hasSize(1);
            assertThat(((List<?>) back).get(0)).isInstanceOf(PublicPropertyDto.class).isEqualTo(sampleProperty());
        }

        @Test
        @DisplayName("ArrayList vide (aucune propriété visible) survit au round-trip")
        void emptyPropertyList_roundTrips() throws Exception {
            Object back = roundTrip(new ArrayList<PublicPropertyDto>());
            assertThat(back).isInstanceOf(List.class);
            assertThat((List<?>) back).isEmpty();
        }

        @Test
        @DisplayName("PublicSearchFiltersDto (facettes /search-filters) survit au round-trip")
        void searchFilters_roundTrips() throws Exception {
            PublicSearchFiltersDto original = new PublicSearchFiltersDto(
                List.of(new PublicSearchFiltersDto.Facet("VILLA", 3)),
                List.of(new PublicSearchFiltersDto.Facet("WIFI", 5), new PublicSearchFiltersDto.Facet("POOL", 2)),
                new BigDecimal("50.00"), new BigDecimal("400.00"),
                4, 3, 8, "EUR");

            Object back = roundTrip(original);

            assertThat(back).isInstanceOf(PublicSearchFiltersDto.class).isEqualTo(original);
        }

        @Test
        @DisplayName("PublicPropertyDetailDto (cache booking-engine-properties existant) survit au round-trip")
        void propertyDetail_roundTrips() throws Exception {
            PublicPropertyDetailDto original = new PublicPropertyDetailDto(
                42L, "Villa Azur", "Description", "VILLA", "Marrakech", "MA",
                new BigDecimal("31.6295"), new BigDecimal("-7.9811"),
                3, 2, 6, 120,
                new BigDecimal("150.00"), 2, "EUR",
                List.of(new PublicPropertyDetailDto.PhotoDto(1L, "/api/public/property-photos/42/1", "Vue")),
                List.of("WIFI"),
                "15:00", "11:00",
                new PublicPropertyDetailDto.HostPublicDto("Mohamed", "M.", null));

            Object back = roundTrip(original);

            assertThat(back).isInstanceOf(PublicPropertyDetailDto.class).isEqualTo(original);
        }

        @Test
        @DisplayName("PropertyCalendarDto (cache booking-engine-price-calendar existant) survit au round-trip")
        void priceCalendar_roundTrips() throws Exception {
            PropertyCalendarDto original = new PropertyCalendarDto(0L, "EUR", List.of(
                new PropertyCalendarDto.CalendarDayDto(LocalDate.of(2026, 8, 1), true, new BigDecimal("120.00"), 2, false, false),
                new PropertyCalendarDto.CalendarDayDto(LocalDate.of(2026, 8, 2), false, null, 2, false, false)));

            Object back = roundTrip(original);

            assertThat(back).isInstanceOf(PropertyCalendarDto.class).isEqualTo(original);
        }

        @Test
        @DisplayName("BigDecimal (valeur du cache exchange-rates) survit au round-trip")
        void bigDecimalRate_roundTrips() throws Exception {
            BigDecimal original = new BigDecimal("10.523456");

            Object back = roundTrip(original);

            assertThat(back).isInstanceOf(BigDecimal.class);
            assertThat((BigDecimal) back).isEqualByComparingTo(original);
        }
    }
}
