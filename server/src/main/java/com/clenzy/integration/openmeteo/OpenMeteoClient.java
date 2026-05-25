package com.clenzy.integration.openmeteo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.Duration;
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
    private static final Duration CACHE_TTL = Duration.ofHours(1);
    private static final String CACHE_GEOCODE_PREFIX = "weather:geocode:";
    private static final String CACHE_FORECAST_PREFIX = "weather:forecast:";

    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final String geocodingBaseUrl;
    private final String forecastBaseUrl;

    public OpenMeteoClient(RestTemplate restTemplate,
                            RedisTemplate<String, Object> redisTemplate,
                            @Value("${openmeteo.geocoding-url:https://geocoding-api.open-meteo.com}") String geocodingBaseUrl,
                            @Value("${openmeteo.forecast-url:https://api.open-meteo.com}") String forecastBaseUrl) {
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
        this.geocodingBaseUrl = geocodingBaseUrl;
        this.forecastBaseUrl = forecastBaseUrl;
    }

    /**
     * Resolution ville → coordonnees. Cache Redis 1h.
     *
     * @param city nom de la ville (insensible casse, tronque a 80 chars)
     * @return coordonnees ou empty si geocoding echoue
     */
    public Optional<GeoCoord> geocode(String city) {
        if (city == null || city.isBlank()) return Optional.empty();
        String normalized = city.trim().toLowerCase(Locale.ROOT);
        String cacheKey = CACHE_GEOCODE_PREFIX + normalized;

        Object cached = readCache(cacheKey);
        if (cached instanceof GeoCoord gc) {
            return Optional.of(gc);
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
                return Optional.empty();
            }
            GeocodingResult hit = response.results.get(0);
            if (hit.latitude == null || hit.longitude == null) return Optional.empty();
            // Open-Meteo retourne `country_code` (snake_case), Jackson par defaut
            // ne le mappe pas vers `countryCode`. On lit `country_code` directement.
            String cc = hit.country_code != null ? hit.country_code : hit.countryCode;
            GeoCoord coord = new GeoCoord(
                    hit.latitude.doubleValue(),
                    hit.longitude.doubleValue(),
                    hit.name != null ? hit.name : city,
                    cc);
            writeCache(cacheKey, coord);
            return Optional.of(coord);
        } catch (Exception e) {
            log.warn("Open-Meteo geocoding failed for '{}': {}", city, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Recupere la prevision quotidienne sur {@code days} jours. Cache Redis 1h.
     *
     * @param coord coordonnees geographiques
     * @param days  nombre de jours (clamp 1..7)
     * @return liste de previsions ou empty si l'appel echoue
     */
    public Optional<List<DailyForecast>> forecast(GeoCoord coord, int days) {
        if (coord == null) return Optional.empty();
        int safeDays = Math.max(1, Math.min(7, days));
        String cacheKey = CACHE_FORECAST_PREFIX
                + coord.latitude + ":" + coord.longitude + ":" + safeDays;

        Object cached = readCache(cacheKey);
        if (cached instanceof ForecastResponse fr) {
            return Optional.of(toDailyForecasts(fr));
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
            if (response == null || response.daily == null) return Optional.empty();
            writeCache(cacheKey, response);
            return Optional.of(toDailyForecasts(response));
        } catch (Exception e) {
            log.warn("Open-Meteo forecast failed at {},{}: {}",
                    coord.latitude, coord.longitude, e.getMessage());
            return Optional.empty();
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

    private Object readCache(String key) {
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            log.debug("Redis read failed for key {}: {}", key, e.getMessage());
            return null;
        }
    }

    private void writeCache(String key, Object value) {
        try {
            redisTemplate.opsForValue().set(key, value, CACHE_TTL);
        } catch (Exception e) {
            log.debug("Redis write failed for key {}: {}", key, e.getMessage());
        }
    }

    // ─── DTOs (records publics — serialises en cache et exposes au tool) ────

    /** Coordonnees resolues par le geocoding. */
    public record GeoCoord(double latitude, double longitude, String resolvedName, String countryCode) {}

    /** Prevision pour un jour. */
    public record DailyForecast(LocalDate date, Double tempMax, Double tempMin,
                                  Double precipitationMm, Integer weatherCode) {}

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
    static class ForecastResponse {
        public Daily daily;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Daily {
        public List<String> time;
        public List<Double> temperature_2m_max;
        public List<Double> temperature_2m_min;
        public List<Double> precipitation_sum;
        public List<Integer> weathercode;
    }
}
