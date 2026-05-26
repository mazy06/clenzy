package com.clenzy.integration.openmeteo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Client pour l'API publique Open-Meteo (https://open-meteo.com/).
 *
 * <p>API gratuite, sans cle, deux endpoints utilises :
 * <ul>
 *   <li>{@code /v1/search} (geocoding-api.open-meteo.com) : ville → lat/lon</li>
 *   <li>{@code /v1/forecast} (api.open-meteo.com) : previsions quotidiennes</li>
 * </ul>
 *
 * <p>Cache Redis (TTL 1h) sur :
 * <ul>
 *   <li>{@code weather:geocode:<city>} → couple lat/lon</li>
 *   <li>{@code weather:forecast:<lat>:<lon>:<days>} → JSON brut Open-Meteo</li>
 * </ul>
 *
 * <p>Echec reseau ou Redis down : on log un warn et on retourne {@link Optional#empty()}.
 * Le tool consommateur expliquera au LLM que la donnee est indisponible.</p>
 */
@Component
public class OpenMeteoClient {

    private static final Logger log = LoggerFactory.getLogger(OpenMeteoClient.class);
    /**
     * Fenetre "fresh" : sous ce seuil, la valeur cachee est servie sans tenter
     * d'appel reseau. Au-dela, on tente un re-fetch HTTP ; si l'appel reussit,
     * on rafraichit. Si l'appel echoue mais qu'on est encore dans
     * {@link #CACHE_STALE_TTL}, on renvoie le snapshot avec {@code stale=true}.
     */
    private static final Duration CACHE_FRESH_WINDOW = Duration.ofHours(1);
    /**
     * Duree de retention totale du snapshot. Au-dela, on considere la valeur
     * trop vieille pour etre servie (le tool renverra une erreur a l'utilisateur).
     */
    private static final Duration CACHE_STALE_TTL = Duration.ofHours(24);
    private static final String CACHE_GEOCODE_PREFIX = "weather:geocode:";
    private static final String CACHE_FORECAST_PREFIX = "weather:forecast:";

    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final Clock clock;
    private final String geocodingBaseUrl;
    private final String forecastBaseUrl;

    public OpenMeteoClient(RestTemplate restTemplate,
                            RedisTemplate<String, Object> redisTemplate,
                            @Value("${openmeteo.geocoding-url:https://geocoding-api.open-meteo.com}") String geocodingBaseUrl,
                            @Value("${openmeteo.forecast-url:https://api.open-meteo.com}") String forecastBaseUrl) {
        this(restTemplate, redisTemplate, Clock.systemUTC(), geocodingBaseUrl, forecastBaseUrl);
    }

    /** Constructeur test-friendly avec horloge injectable (deterministe). */
    OpenMeteoClient(RestTemplate restTemplate,
                     RedisTemplate<String, Object> redisTemplate,
                     Clock clock,
                     String geocodingBaseUrl,
                     String forecastBaseUrl) {
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
        this.clock = clock;
        this.geocodingBaseUrl = geocodingBaseUrl;
        this.forecastBaseUrl = forecastBaseUrl;
    }

    /**
     * Resolution ville → coordonnees. Cache Redis stale-while-revalidate :
     * fresh 1h, stale jusqu'a 24h (la geolocalisation d'une ville ne bouge
     * jamais, le stale est sans risque).
     *
     * @param city nom de la ville (insensible casse, tronque a 80 chars)
     * @return coordonnees ou empty si geocoding echoue ET aucun cache stale dispo
     */
    public Optional<GeoCoord> geocode(String city) {
        if (city == null || city.isBlank()) return Optional.empty();
        String normalized = city.trim().toLowerCase(Locale.ROOT);
        String cacheKey = CACHE_GEOCODE_PREFIX + normalized;

        CachedSnapshot<GeoCoord> cached = readCachedSnapshot(cacheKey, GeoCoord.class);
        if (cached != null && isFresh(cached)) {
            return Optional.of(cached.value);
        }

        String url = UriComponentsBuilder.fromUriString(geocodingBaseUrl)
                .path("/v1/search")
                .queryParam("name", city)
                .queryParam("count", 1)
                .queryParam("language", "fr")
                .queryParam("format", "json")
                .toUriString();

        try {
            GeocodingResponse response = restTemplate.getForObject(url, GeocodingResponse.class);
            if (response == null || response.results == null || response.results.isEmpty()) {
                log.info("Open-Meteo geocoding: aucun resultat pour '{}'", city);
                // On garde le cache stale si dispo — un blip Open-Meteo ne doit pas
                // priver l'user d'une coord connue.
                return cached != null ? Optional.of(cached.value) : Optional.empty();
            }
            GeocodingResult hit = response.results.get(0);
            if (hit.latitude == null || hit.longitude == null) {
                return cached != null ? Optional.of(cached.value) : Optional.empty();
            }
            // Open-Meteo retourne `country_code` (snake_case), Jackson par defaut
            // ne le mappe pas vers `countryCode`. On lit `country_code` directement.
            String cc = hit.country_code != null ? hit.country_code : hit.countryCode;
            GeoCoord coord = new GeoCoord(
                    hit.latitude.doubleValue(),
                    hit.longitude.doubleValue(),
                    hit.name != null ? hit.name : city,
                    cc);
            writeCacheSnapshot(cacheKey, coord);
            return Optional.of(coord);
        } catch (Exception e) {
            log.warn("Open-Meteo geocoding failed for '{}': {} — fallback stale={}",
                    city, e.getMessage(), cached != null);
            return cached != null ? Optional.of(cached.value) : Optional.empty();
        }
    }

    /**
     * Recupere la prevision quotidienne sur {@code days} jours. Cache Redis
     * stale-while-revalidate : fresh 1h, stale jusqu'a 24h.
     *
     * @param coord coordonnees geographiques
     * @param days  nombre de jours (clamp 1..7)
     * @return snapshot {items + stale flag} ou empty si HTTP fail ET pas de stale dispo
     */
    public Optional<ForecastSnapshot> forecast(GeoCoord coord, int days) {
        if (coord == null) return Optional.empty();
        int safeDays = Math.max(1, Math.min(7, days));
        String cacheKey = CACHE_FORECAST_PREFIX
                + coord.latitude + ":" + coord.longitude + ":" + safeDays;

        CachedSnapshot<ForecastResponse> cached = readCachedSnapshot(cacheKey, ForecastResponse.class);
        if (cached != null && isFresh(cached)) {
            return Optional.of(new ForecastSnapshot(toDailyForecasts(cached.value), false));
        }

        String url = UriComponentsBuilder.fromUriString(forecastBaseUrl)
                .path("/v1/forecast")
                .queryParam("latitude", coord.latitude)
                .queryParam("longitude", coord.longitude)
                .queryParam("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode")
                .queryParam("forecast_days", safeDays)
                .queryParam("timezone", "auto")
                .toUriString();

        try {
            ForecastResponse response = restTemplate.getForObject(url, ForecastResponse.class);
            if (response == null || response.daily == null) {
                return cached != null
                        ? Optional.of(new ForecastSnapshot(toDailyForecasts(cached.value), true))
                        : Optional.empty();
            }
            writeCacheSnapshot(cacheKey, response);
            return Optional.of(new ForecastSnapshot(toDailyForecasts(response), false));
        } catch (Exception e) {
            log.warn("Open-Meteo forecast failed at {},{}: {} — fallback stale={}",
                    coord.latitude, coord.longitude, e.getMessage(), cached != null);
            return cached != null
                    ? Optional.of(new ForecastSnapshot(toDailyForecasts(cached.value), true))
                    : Optional.empty();
        }
    }

    private List<DailyForecast> toDailyForecasts(ForecastResponse response) {
        List<DailyForecast> items = new ArrayList<>();
        Daily d = response.daily;
        if (d == null || d.time == null) return items;
        int n = d.time.size();
        for (int i = 0; i < n; i++) {
            LocalDate date = parseDateSafe(d.time.get(i));
            if (date == null) continue;
            Double tMax = pick(d.temperature_2m_max, i);
            Double tMin = pick(d.temperature_2m_min, i);
            Double rain = pick(d.precipitation_sum, i);
            Integer code = pickInt(d.weathercode, i);
            items.add(new DailyForecast(date, tMax, tMin, rain, code));
        }
        return items;
    }

    private static LocalDate parseDateSafe(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw); } catch (Exception e) { return null; }
    }

    private static Double pick(List<Double> list, int i) {
        return list != null && i < list.size() ? list.get(i) : null;
    }

    private static Integer pickInt(List<Integer> list, int i) {
        return list != null && i < list.size() ? list.get(i) : null;
    }

    /**
     * Lit un snapshot cache ET le caste si le type matche. Renvoie null si la
     * cle est absente, la lecture Redis echoue, ou le type cache ne matche pas
     * (cache pre-SWR par exemple — on l'ignore comme "miss").
     */
    private <T extends Serializable> CachedSnapshot<T> readCachedSnapshot(String key, Class<T> type) {
        try {
            Object raw = redisTemplate.opsForValue().get(key);
            if (raw instanceof CachedSnapshot<?> snap && snap.value != null
                    && type.isInstance(snap.value)) {
                @SuppressWarnings("unchecked")
                CachedSnapshot<T> casted = (CachedSnapshot<T>) snap;
                return casted;
            }
            return null;
        } catch (Exception e) {
            log.debug("Redis read failed for key {}: {}", key, e.getMessage());
            return null;
        }
    }

    private <T extends Serializable> void writeCacheSnapshot(String key, T value) {
        try {
            CachedSnapshot<T> snap = new CachedSnapshot<>(value, Instant.now(clock).toEpochMilli());
            redisTemplate.opsForValue().set(key, snap, CACHE_STALE_TTL);
        } catch (Exception e) {
            log.debug("Redis write failed for key {}: {}", key, e.getMessage());
        }
    }

    private boolean isFresh(CachedSnapshot<?> snap) {
        long ageMillis = Instant.now(clock).toEpochMilli() - snap.cachedAtEpochMillis;
        return ageMillis < CACHE_FRESH_WINDOW.toMillis();
    }

    // ─── DTOs (records publics — serialises en cache et exposes au tool) ────

    /** Coordonnees resolues par le geocoding. Implements Serializable pour cache Redis. */
    public record GeoCoord(double latitude, double longitude, String resolvedName, String countryCode)
            implements Serializable {}

    /** Prevision pour un jour. */
    public record DailyForecast(LocalDate date, Double tempMax, Double tempMin,
                                  Double precipitationMm, Integer weatherCode) {}

    /**
     * Resultat de {@link #forecast(GeoCoord, int)}. Le flag {@code stale}
     * indique que la donnee provient d'un cache > 1h (servi en fallback parce
     * que l'API Open-Meteo n'a pas repondu).
     */
    public record ForecastSnapshot(List<DailyForecast> items, boolean stale) {}

    /**
     * Wrapper interne stocke en Redis — porte la valeur ET le timestamp de mise
     * en cache. Permet de distinguer "fresh" de "stale" sans avoir a stocker
     * la TTL Redis (qu'on ne peut pas relire facilement).
     */
    static final class CachedSnapshot<T extends Serializable> implements Serializable {
        private static final long serialVersionUID = 1L;
        public T value;
        public long cachedAtEpochMillis;

        public CachedSnapshot() {}

        public CachedSnapshot(T value, long cachedAtEpochMillis) {
            this.value = value;
            this.cachedAtEpochMillis = cachedAtEpochMillis;
        }
    }

    // ─── DTOs internes Open-Meteo (jackson) ─────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GeocodingResponse {
        public List<GeocodingResult> results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GeocodingResult {
        public String name;
        public BigDecimal latitude;
        public BigDecimal longitude;
        public String country;
        public String country_code;
        public String countryCode;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ForecastResponse implements Serializable {
        private static final long serialVersionUID = 1L;
        public Daily daily;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Daily implements Serializable {
        private static final long serialVersionUID = 1L;
        public List<String> time;
        public List<Double> temperature_2m_max;
        public List<Double> temperature_2m_min;
        public List<Double> precipitation_sum;
        public List<Integer> weathercode;
    }
}
