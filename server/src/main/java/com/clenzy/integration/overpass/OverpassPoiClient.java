package com.clenzy.integration.overpass;

import com.clenzy.dto.PoiSuggestionDto;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.Serializable;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Client Overpass (OpenStreetMap) : points d'intérêt autour d'un logement.
 * Gratuit, sans clé d'API. Cache Redis 24h, dégradation gracieuse (retourne une
 * liste vide si Overpass/Redis indisponible — la suggestion auto n'est jamais bloquante).
 */
@Component
public class OverpassPoiClient {

    private static final Logger log = LoggerFactory.getLogger(OverpassPoiClient.class);
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final String CACHE_PREFIX = "poi:suggest:";
    private static final int MAX_PER_CATEGORY = 6;
    private static final int MAX_TOTAL = 40;

    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final String baseUrl;

    public OverpassPoiClient(RestTemplate restTemplate,
                             RedisTemplate<String, Object> redisTemplate,
                             @Value("${overpass.base-url:https://overpass-api.de/api/interpreter}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
        this.baseUrl = baseUrl;
    }

    /** Suggestions de POI autour de (lat, lon) dans un rayon (m). Vide si rien ou erreur. */
    public List<PoiSuggestionDto> suggestNearby(double lat, double lon, int radiusMeters) {
        String cacheKey = CACHE_PREFIX + round(lat) + ":" + round(lon) + ":" + radiusMeters;

        List<PoiSuggestionDto> cached = readCache(cacheKey);
        if (cached != null) {
            return cached;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            OverpassResponse response = restTemplate.postForObject(
                baseUrl, new HttpEntity<>(buildQuery(lat, lon, radiusMeters), headers), OverpassResponse.class);
            List<PoiSuggestionDto> result = map(response);
            writeCache(cacheKey, result);
            return result;
        } catch (Exception e) {
            log.warn("Overpass POI fetch failed at {},{}: {}", lat, lon, e.getMessage());
            return List.of();
        }
    }

    private static String buildQuery(double lat, double lon, int radius) {
        String around = "(around:" + radius + "," + lat + "," + lon + ");";
        return "[out:json][timeout:25];("
            + "nwr[\"amenity\"~\"restaurant|cafe|bar|pub|pharmacy|hospital|clinic|bus_station\"]" + around
            + "nwr[\"shop\"~\"supermarket|convenience|grocery|bakery|mall|department_store\"]" + around
            + "nwr[\"tourism\"~\"attraction|museum|gallery|viewpoint|artwork\"]" + around
            + "nwr[\"natural\"=\"beach\"]" + around
            + "nwr[\"railway\"=\"station\"]" + around
            + ");out center " + MAX_TOTAL * 3 + ";";
    }

    private List<PoiSuggestionDto> map(OverpassResponse response) {
        List<PoiSuggestionDto> out = new ArrayList<>();
        if (response == null || response.elements == null) {
            return out;
        }
        Set<String> seen = new HashSet<>();
        Map<String, Integer> perCategory = new HashMap<>();
        for (OverpassElement el : response.elements) {
            if (el.tags == null) continue;
            String name = el.tags.get("name");
            if (name == null || name.isBlank()) continue;
            String category = category(el.tags);
            if (category == null) continue;
            double elLat = el.lat != null ? el.lat : (el.center != null && el.center.lat != null ? el.center.lat : Double.NaN);
            double elLon = el.lon != null ? el.lon : (el.center != null && el.center.lon != null ? el.center.lon : Double.NaN);
            if (Double.isNaN(elLat) || Double.isNaN(elLon)) continue;
            String key = category + "|" + name.toLowerCase(Locale.ROOT);
            if (!seen.add(key)) continue;
            int count = perCategory.getOrDefault(category, 0);
            if (count >= MAX_PER_CATEGORY) continue;
            perCategory.put(category, count + 1);
            out.add(new PoiSuggestionDto(category, name, address(el.tags), elLat, elLon));
            if (out.size() >= MAX_TOTAL) break;
        }
        return out;
    }

    /** Mappe les tags OSM vers une catégorie POI Clenzy (null = non mappé, ignoré). */
    private static String category(Map<String, String> tags) {
        String amenity = tags.get("amenity");
        if (amenity != null) {
            switch (amenity) {
                case "restaurant": return "RESTAURANT";
                case "cafe": return "CAFE";
                case "bar": case "pub": return "BAR";
                case "pharmacy": return "PHARMACY";
                case "hospital": case "clinic": case "doctors": return "HEALTH";
                case "bus_station": return "TRANSPORT";
                default: break;
            }
        }
        String shop = tags.get("shop");
        if (shop != null) {
            switch (shop) {
                case "supermarket": case "convenience": case "grocery": case "bakery": return "GROCERY";
                case "mall": case "department_store": return "SHOPPING";
                default: break;
            }
        }
        String tourism = tags.get("tourism");
        if (tourism != null) {
            switch (tourism) {
                case "attraction": case "museum": case "gallery": case "viewpoint": case "artwork": return "ATTRACTION";
                default: break;
            }
        }
        if ("beach".equals(tags.get("natural"))) return "BEACH";
        if ("station".equals(tags.get("railway"))) return "TRANSPORT";
        return null;
    }

    private static String address(Map<String, String> tags) {
        String houseNumber = tags.get("addr:housenumber");
        String street = tags.get("addr:street");
        String city = tags.get("addr:city");
        StringBuilder sb = new StringBuilder();
        if (street != null) {
            if (houseNumber != null) sb.append(houseNumber).append(' ');
            sb.append(street);
        }
        if (city != null) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    @SuppressWarnings("unchecked")
    private List<PoiSuggestionDto> readCache(String key) {
        try {
            Object raw = redisTemplate.opsForValue().get(key);
            return raw instanceof List<?> list ? (List<PoiSuggestionDto>) list : null;
        } catch (Exception e) {
            return null;
        }
    }

    private void writeCache(String key, List<PoiSuggestionDto> value) {
        try {
            redisTemplate.opsForValue().set(key, new ArrayList<>(value), CACHE_TTL);
        } catch (Exception e) {
            log.debug("Redis write failed for {}: {}", key, e.getMessage());
        }
    }

    // ─── DTOs Overpass (Jackson) ────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OverpassResponse implements Serializable {
        private static final long serialVersionUID = 1L;
        public List<OverpassElement> elements;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OverpassElement implements Serializable {
        private static final long serialVersionUID = 1L;
        public Double lat;
        public Double lon;
        public Center center;
        public Map<String, String> tags;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Center implements Serializable {
        private static final long serialVersionUID = 1L;
        public Double lat;
        public Double lon;
    }
}
