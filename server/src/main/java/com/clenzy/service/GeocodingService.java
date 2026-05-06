package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

/**
 * Geocodage worldwide via Nominatim (OpenStreetMap).
 * Utilise pour le rattrapage des proprietes existantes sans coordonnees GPS.
 * <p>
 * Limites Nominatim : 1 requete/seconde maximum.
 */
@Service
public class GeocodingService {

    private static final Logger log = LoggerFactory.getLogger(GeocodingService.class);

    private static final String NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
    private static final String USER_AGENT = "Clenzy-PMS/1.0 (contact@clenzy.fr)";
    private static final long RATE_LIMIT_DELAY_MS = 1100L; // 1.1s pour respecter la regle 1 req/s

    private final PropertyRepository propertyRepository;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GeocodingService(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Resultat du geocodage : lat/lon + code pays ISO.
     */
    public record GeocodeResult(BigDecimal latitude, BigDecimal longitude, String countryCode) {
    }

    /**
     * Geocode une adresse via Nominatim.
     *
     * @param query       texte d'adresse libre (ex: "10 rue de Rivoli, Paris")
     * @param countryCode code ISO 3166-1 alpha-2 facultatif pour restreindre la recherche
     * @return resultat ou null si rien trouve
     */
    public GeocodeResult geocode(String query, String countryCode) {
        if (query == null || query.isBlank()) return null;

        try {
            StringBuilder url = new StringBuilder(NOMINATIM_URL)
                    .append("?q=").append(URLEncoder.encode(query.trim(), StandardCharsets.UTF_8))
                    .append("&format=json&addressdetails=1&limit=1");

            if (countryCode != null && !countryCode.isBlank()) {
                url.append("&countrycodes=").append(countryCode.toLowerCase());
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url.toString()))
                    .GET()
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept-Language", "fr,en;q=0.8")
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Nominatim HTTP {} pour query='{}'", response.statusCode(), query);
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            if (!root.isArray() || root.isEmpty()) {
                return null;
            }

            JsonNode first = root.get(0);
            BigDecimal lat = new BigDecimal(first.get("lat").asText());
            BigDecimal lon = new BigDecimal(first.get("lon").asText());
            String cc = null;
            JsonNode addr = first.get("address");
            if (addr != null && addr.has("country_code")) {
                cc = addr.get("country_code").asText().toUpperCase();
            }
            return new GeocodeResult(lat, lon, cc);
        } catch (IOException | InterruptedException e) {
            log.warn("Erreur Nominatim pour query='{}': {}", query, e.getMessage());
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return null;
        }
    }

    /**
     * Construit une chaine d'adresse exploitable pour le geocodage a partir d'une propriete.
     */
    private String buildAddressQuery(Property p) {
        StringBuilder sb = new StringBuilder();
        if (p.getAddress() != null) sb.append(p.getAddress()).append(", ");
        if (p.getPostalCode() != null) sb.append(p.getPostalCode()).append(" ");
        if (p.getCity() != null) sb.append(p.getCity()).append(", ");
        if (p.getCountry() != null) sb.append(p.getCountry());
        return sb.toString().trim().replaceAll(",$", "");
    }

    /**
     * Resultat du batch de retro-geocodage.
     */
    public record RetroGeocodeReport(int total, int updated, int skipped, int failed) {
    }

    /**
     * Rattrape les coordonnees GPS de toutes les proprietes qui en sont depourvues.
     * Respecte le rate limit Nominatim (1 req/sec).
     */
    @Transactional
    public RetroGeocodeReport retroGeocodeMissing() {
        List<Property> properties = propertyRepository.findAllWithoutCoordinates();
        int updated = 0;
        int skipped = 0;
        int failed = 0;

        log.info("Retro-geocodage : {} proprietes sans coordonnees GPS a traiter", properties.size());

        for (Property p : properties) {
            String query = buildAddressQuery(p);
            if (query.isBlank()) {
                skipped++;
                continue;
            }

            GeocodeResult result = geocode(query, p.getCountryCode());
            if (result == null) {
                failed++;
                log.warn("Retro-geocodage echoue pour propriete #{} (query='{}')", p.getId(), query);
            } else {
                p.setLatitude(result.latitude());
                p.setLongitude(result.longitude());
                if ((p.getCountryCode() == null || p.getCountryCode().isBlank()) && result.countryCode() != null) {
                    p.setCountryCode(result.countryCode());
                }
                propertyRepository.save(p);
                updated++;
                log.info("Propriete #{} geocodee : ({}, {})", p.getId(), result.latitude(), result.longitude());
            }

            // Rate limit Nominatim
            try {
                Thread.sleep(RATE_LIMIT_DELAY_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        log.info("Retro-geocodage termine : {} mises a jour, {} echecs, {} ignorees sur {} totales",
                updated, failed, skipped, properties.size());

        return new RetroGeocodeReport(properties.size(), updated, skipped, failed);
    }
}
