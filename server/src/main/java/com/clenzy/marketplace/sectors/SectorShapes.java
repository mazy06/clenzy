package com.clenzy.marketplace.sectors;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.operation.union.UnaryUnionOp;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Assemble les contours : les zones d'un prestataire deviennent un seul secteur (les
 * arrondissements voisins perdent leurs frontières communes), puis l'ensemble des
 * secteurs affichés est réuni à son tour pour la vue « fusionnée ».
 */
@Component
public class SectorShapes {

    /** Zone telle que déclarée, quelle que soit sa table d'origine. */
    public record DeclaredZone(String country, String department, String arrondissement, String city) {
    }

    /** Secteur d'un prestataire, avec sa géométrie JTS pour les unions suivantes. */
    public record Shape(SectorMapDto.ProviderSectors sectors, Geometry geometry) {
    }

    private final SectorGeometryCatalog catalog;

    public SectorShapes(SectorGeometryCatalog catalog) {
        this.catalog = catalog;
    }

    public Shape provider(Long providerId, String name, List<DeclaredZone> declared) {
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
        return new Shape(new SectorMapDto.ProviderSectors(providerId, name,
                union == null ? null : GeoJsonGeometries.write(union), zones), union);
    }

    public SectorMapDto map(List<Shape> shapes, List<SectorMapDto.SectorProperty> properties) {
        Geometry merged = union(shapes.stream().map(Shape::geometry).filter(Objects::nonNull).toList());
        return new SectorMapDto(shapes.stream().map(Shape::sectors).toList(),
                merged == null ? null : GeoJsonGeometries.write(merged), properties, catalog.attribution());
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
