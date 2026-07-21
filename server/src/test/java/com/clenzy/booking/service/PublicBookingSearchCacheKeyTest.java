package com.clenzy.booking.service;

import com.clenzy.booking.dto.PropertySearchFilters;
import com.clenzy.booking.dto.PublicSearchFiltersDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.model.DataSourceMode;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.Organization;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.Cacheable;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Clé + câblage du cache public {@code booking-engine-search}.
 *
 * <p>La clé DOIT inclure tout paramètre qui fait varier la réponse publique (org, engine,
 * mode MOCK/REAL, curation featured, devise, filtres) : une clé mal scopée servirait le
 * listing d'un engine/org à un autre (donnée publique, mais curation et devise propres à
 * chaque engine) ou du mock au réel après bascule.</p>
 */
@DisplayName("PublicBookingService — cache booking-engine-search")
class PublicBookingSearchCacheKeyTest {

    private static OrgContext ctx(Long orgId, Long configId, DataSourceMode mode, String featured) {
        Organization org = new Organization();
        org.setId(orgId);
        BookingEngineConfig config = new BookingEngineConfig();
        config.setId(configId);
        config.setOrganizationId(orgId);
        config.setDataSourceMode(mode);
        config.setFeaturedPropertyIds(featured);
        return new OrgContext(org, config);
    }

    private static final PropertySearchFilters SOME_FILTERS =
        PropertySearchFilters.of(List.of("VILLA"), new BigDecimal("50"), new BigDecimal("200"), 2, null, 4, List.of("WIFI"));

    @Nested
    @DisplayName("searchCacheKey")
    class SearchCacheKey {

        @Test
        @DisplayName("mêmes entrées → même clé (déterminisme)")
        void sameInputs_sameKey() {
            String a = PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.REAL, "1,2"), "EUR", SOME_FILTERS);
            String b = PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.REAL, "1,2"), "EUR",
                PropertySearchFilters.of(List.of("VILLA"), new BigDecimal("50"), new BigDecimal("200"), 2, null, 4, List.of("WIFI")));
            assertThat(a).isEqualTo(b);
        }

        @Test
        @DisplayName("la clé varie avec CHAQUE paramètre discriminant (org, config, mode, featured, devise, filtres)")
        void keyVariesWithEveryDiscriminatingParameter() {
            OrgContext base = ctx(1L, 7L, DataSourceMode.REAL, "1,2");
            String reference = PublicBookingService.searchCacheKey("props", base, "EUR", SOME_FILTERS);

            assertThat(PublicBookingService.searchCacheKey("props", ctx(2L, 7L, DataSourceMode.REAL, "1,2"), "EUR", SOME_FILTERS))
                .as("org différente").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("props", ctx(1L, 8L, DataSourceMode.REAL, "1,2"), "EUR", SOME_FILTERS))
                .as("engine (config) différent").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.MOCK, "1,2"), "EUR", SOME_FILTERS))
                .as("bascule MOCK/REAL").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.REAL, "1,2,3"), "EUR", SOME_FILTERS))
                .as("curation featured différente").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.REAL, "1,2"), "MAD", SOME_FILTERS))
                .as("devise différente").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("props", ctx(1L, 7L, DataSourceMode.REAL, "1,2"), "EUR", PropertySearchFilters.NONE))
                .as("filtres différents").isNotEqualTo(reference);
            assertThat(PublicBookingService.searchCacheKey("facets", base, "EUR", SOME_FILTERS))
                .as("préfixe listing vs facettes").isNotEqualTo(reference);
        }

        @Test
        @DisplayName("devise null / blank et featured null sont normalisés (pas de NPE, clés égales)")
        void nullAndBlankNormalized() {
            OrgContext noFeatured = ctx(1L, 7L, DataSourceMode.REAL, null);
            String nullCurrency = PublicBookingService.searchCacheKey("facets", noFeatured, null, null);
            String blankCurrency = PublicBookingService.searchCacheKey("facets", noFeatured, "  ", null);
            assertThat(nullCurrency).isEqualTo(blankCurrency);
        }
    }

    @Nested
    @DisplayName("câblage @Cacheable")
    class CacheableWiring {

        @Test
        @DisplayName("getProperties(ctx, filters, currency) est caché dans booking-engine-search")
        void getProperties_isCached() throws NoSuchMethodException {
            Method m = PublicBookingService.class.getMethod(
                "getProperties", OrgContext.class, PropertySearchFilters.class, String.class);
            Cacheable cacheable = m.getAnnotation(Cacheable.class);
            assertThat(cacheable).isNotNull();
            assertThat(cacheable.value()).containsExactly("booking-engine-search");
            assertThat(cacheable.key()).contains("searchCacheKey").contains("'props'");
        }

        @Test
        @DisplayName("getSearchFilters(ctx, currency) est caché dans booking-engine-search")
        void getSearchFilters_isCached() throws NoSuchMethodException {
            Method m = PublicBookingService.class.getMethod(
                "getSearchFilters", OrgContext.class, String.class);
            Cacheable cacheable = m.getAnnotation(Cacheable.class);
            assertThat(cacheable).isNotNull();
            assertThat(cacheable.value()).containsExactly("booking-engine-search");
            assertThat(cacheable.key()).contains("searchCacheKey").contains("'facets'");
        }

        @Test
        @DisplayName("getProperties déclare bien List<PublicPropertyDto> et getSearchFilters PublicSearchFiltersDto")
        void cachedReturnTypesAreSerializableDtos() throws NoSuchMethodException {
            // Garde-fou documentaire : les types retournés sont couverts par les MixIns
            // de CacheConfig (round-trip Redis testé dans CacheConfigTest).
            assertThat(PublicBookingService.class
                .getMethod("getProperties", OrgContext.class, PropertySearchFilters.class, String.class)
                .getReturnType()).isEqualTo(List.class);
            assertThat(PublicBookingService.class
                .getMethod("getSearchFilters", OrgContext.class, String.class)
                .getReturnType()).isEqualTo(PublicSearchFiltersDto.class);
        }
    }
}
