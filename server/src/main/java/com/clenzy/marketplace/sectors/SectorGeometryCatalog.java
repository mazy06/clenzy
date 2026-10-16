package com.clenzy.marketplace.sectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.geom.util.GeometryFixer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Contours des secteurs d'intervention, lus une fois au démarrage depuis
 * {@code geo/baitly-sectors.geojson} (généré par {@code scripts/maps/sectors/}).
 *
 * <p>Le fichier est simplifié pour rester léger : quelques contours en sortent
 * auto-intersectés. Chacun est réparé ici ({@link GeometryFixer}) pour que les unions
 * qui fusionnent les secteurs voisins ne lèvent jamais d'exception topologique.</p>
 */
@Component
public class SectorGeometryCatalog {

    static final String RESOURCE = "geo/baitly-sectors.geojson";

    /** Un contour : département, arrondissement ou ville. {@code approx} = cercle de repli. */
    public record Sector(String key, String kind, String name, boolean approx, Geometry geometry) {
    }

    private final GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
    private final Map<String, Sector> byKey = new HashMap<>();
    // Un département est chargé à la demande, jamais les 35 000 contours au boot.
    private final Map<String, Map<String, Sector>> communes = new ConcurrentHashMap<>();
    private final String attribution;

    public SectorGeometryCatalog(ObjectMapper mapper) {
        JsonNode root;
        try (InputStream input = new ClassPathResource(RESOURCE).getInputStream()) {
            root = mapper.readTree(input);
        } catch (IOException e) {
            throw new UncheckedIOException("Contours des secteurs illisibles : " + RESOURCE, e);
        }
        attribution = root.path("attribution").asText("");
        for (JsonNode feature : root.path("features")) {
            JsonNode properties = feature.path("properties");
            Geometry geometry = GeometryFixer.fix(GeoJsonGeometries.read(feature.path("geometry"), factory));
            Sector sector = new Sector(properties.path("key").asText(), properties.path("kind").asText(),
                    properties.path("name").asText(), properties.path("approx").asBoolean(false), geometry);
            byKey.put(sector.key(), sector);
            String country = sector.key().substring(0, 2);
            properties.path("aliases").forEach(alias -> byKey.putIfAbsent(country + "-C-" + alias.asText(), sector));
        }
    }

    public Optional<Sector> find(String country, String department, String arrondissement, String city) {
        String key = SectorKey.of(country, department, arrondissement, city);
        if (key != null && key.startsWith("FR-C-") && department != null) {
            String dept = department.trim().toUpperCase(java.util.Locale.ROOT);
            if (!dept.matches("[0-9A-Z]{2,3}")) return Optional.empty();
            return Optional.ofNullable(communes.computeIfAbsent(dept, this::loadCommunes).get(key));
        }
        return key == null ? Optional.empty() : Optional.ofNullable(byKey.get(key));
    }

    private Map<String, Sector> loadCommunes(String department) {
        var resource = new ClassPathResource("geo/baitly-communes/" + department + ".geojson");
        if (!resource.exists()) return Map.of();
        try (var input = resource.getInputStream()) {
            var result = new HashMap<String, Sector>();
            for (JsonNode feature : new ObjectMapper().readTree(input).path("features")) {
                JsonNode properties = feature.path("properties");
                var sector = new Sector(properties.path("key").asText(), "city", properties.path("name").asText(), false,
                        GeometryFixer.fix(GeoJsonGeometries.read(feature.path("geometry"), factory)));
                result.put(sector.key(), sector);
            }
            return Map.copyOf(result);
        } catch (IOException e) { throw new UncheckedIOException("Contours des communes illisibles : " + department, e); }
    }

    public GeometryFactory factory() {
        return factory;
    }

    public String attribution() {
        return attribution;
    }
}
