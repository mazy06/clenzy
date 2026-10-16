package com.clenzy.marketplace.sectors;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.operation.union.UnaryUnionOp;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Assemble les contours : les zones d'un prestataire deviennent un seul secteur (les
 * arrondissements voisins perdent leurs frontières communes), puis l'ensemble des
 * secteurs affichés est réuni à son tour pour la vue « fusionnée ».
 *
 * <p>Les unions JTS sont la part coûteuse de la carte des secteurs : elles sont mémorisées,
 * clés = les zones déclarées elles-mêmes. Les données (zones, couverture, logements) restent
 * lues à chaque requête ; une zone modifiée donne une autre clé, donc jamais de résultat
 * périmé et aucune invalidation à orchestrer. Les géométries partagées ne sont que lues.</p>
 */
@Component
public class SectorShapes {

    /** Zone telle que déclarée, quelle que soit sa table d'origine. */
    public record DeclaredZone(String country, String department, String arrondissement, String city) {
    }

    /** Secteur d'un prestataire, avec sa géométrie JTS et ses zones (clé des unions suivantes). */
    public record Shape(SectorMapDto.ProviderSectors sectors, Geometry geometry, List<DeclaredZone> declared) {
        public Shape withUserId(Long userId) {
            return new Shape(sectors.withUserId(userId), geometry, declared);
        }
    }

    /** Zones résolues d'un jeu de zones déclarées : contours, union et son GeoJSON. */
    private record Resolved(List<SectorMapDto.Zone> zones, Geometry union, Map<String, Object> geoJson) {
    }

    private final Cache<List<DeclaredZone>, Resolved> resolved = Caffeine.newBuilder().maximumSize(2_000).build();
    private final Cache<List<List<DeclaredZone>>, Optional<Map<String, Object>>> merged =
            Caffeine.newBuilder().maximumSize(500).build();

    private final SectorGeometryCatalog catalog;

    public SectorShapes(SectorGeometryCatalog catalog) {
        this.catalog = catalog;
    }

    public Shape provider(Long providerId, String name, List<DeclaredZone> declared) {
        return provider(providerId, name, null, declared);
    }

    public Shape provider(Long providerId, String name, String avatarUrl, List<DeclaredZone> declared) {
        List<DeclaredZone> key = List.copyOf(declared);
        Resolved zonesOf = resolved.get(key, this::resolve);
        return new Shape(new SectorMapDto.ProviderSectors(providerId, name, avatarUrl, zonesOf.geoJson(), zonesOf.zones(), null),
                zonesOf.union(), key);
    }

    private Resolved resolve(List<DeclaredZone> declared) {
        List<SectorMapDto.Zone> zones = new ArrayList<>();
        List<Geometry> parts = new ArrayList<>();
        for (DeclaredZone zone : declared) {
            var sector = catalog.find(zone.country(), zone.department(), zone.arrondissement(), zone.city());
            if (sector.isPresent()) {
                var found = sector.get();
                parts.add(found.geometry());
                zones.add(new SectorMapDto.Zone(found.key(), found.name(), found.kind(), found.approx(), true));
            } else {
                zones.add(new SectorMapDto.Zone(null, label(zone), "unknown", false, false));
            }
        }
        Geometry union = union(parts);
        return new Resolved(List.copyOf(zones), union, union == null ? null : GeoJsonGeometries.write(union));
    }

    public SectorMapDto map(List<Shape> shapes, List<SectorMapDto.SectorProperty> properties) {
        List<List<DeclaredZone>> key = shapes.stream().map(Shape::declared).toList();
        Optional<Map<String, Object>> outline = merged.get(key, ignored -> {
            Geometry union = union(shapes.stream().map(Shape::geometry).filter(Objects::nonNull).toList());
            return Optional.ofNullable(union == null ? null : GeoJsonGeometries.write(union));
        });
        return new SectorMapDto(shapes.stream().map(Shape::sectors).toList(), outline.orElse(null), properties, catalog.attribution());
    }

    private Geometry union(List<Geometry> parts) {
        if (parts.isEmpty()) return null;
        return UnaryUnionOp.union(parts, catalog.factory());
    }

    private static String label(DeclaredZone zone) {
        if (zone.arrondissement() != null && !zone.arrondissement().isBlank()) return zone.arrondissement();
        if (zone.department() != null && !zone.department().isBlank()) return zone.department();
        return zone.city() == null ? "" : zone.city();
    }
}
