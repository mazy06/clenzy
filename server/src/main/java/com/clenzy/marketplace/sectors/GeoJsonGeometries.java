package com.clenzy.marketplace.sectors;

import com.fasterxml.jackson.databind.JsonNode;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.MultiPolygon;
import org.locationtech.jts.geom.Polygon;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Conversion GeoJSON ↔ JTS, limitée aux surfaces : un secteur est toujours un
 * Polygon ou un MultiPolygon. Les coordonnées sortantes sont arrondies à 5 décimales
 * (~1 m), la précision du fichier source.
 */
final class GeoJsonGeometries {

    private static final int DECIMALS = 5;

    private GeoJsonGeometries() {
    }

    static Geometry read(JsonNode geometry, GeometryFactory factory) {
        String type = geometry.path("type").asText();
        JsonNode coordinates = geometry.path("coordinates");
        return switch (type) {
            case "Polygon" -> polygon(coordinates, factory);
            case "MultiPolygon" -> {
                List<Polygon> parts = new ArrayList<>();
                coordinates.forEach(part -> parts.add(polygon(part, factory)));
                yield factory.createMultiPolygon(parts.toArray(Polygon[]::new));
            }
            default -> throw new IllegalArgumentException("Contour de secteur non surfacique : " + type);
        };
    }

    /** Polygon, MultiPolygon, ou la seule partie surfacique d'une collection (résultat d'union). */
    static Map<String, Object> write(Geometry geometry) {
        List<Polygon> polygons = new ArrayList<>();
        for (int i = 0; i < geometry.getNumGeometries(); i++) {
            Geometry part = geometry.getGeometryN(i);
            if (part instanceof Polygon polygon && !polygon.isEmpty()) polygons.add(polygon);
            else if (part instanceof MultiPolygon multi) {
                for (int j = 0; j < multi.getNumGeometries(); j++) polygons.add((Polygon) multi.getGeometryN(j));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if (polygons.size() == 1) {
            out.put("type", "Polygon");
            out.put("coordinates", rings(polygons.getFirst()));
        } else {
            out.put("type", "MultiPolygon");
            out.put("coordinates", polygons.stream().map(GeoJsonGeometries::rings).toList());
        }
        return out;
    }

    private static Polygon polygon(JsonNode rings, GeometryFactory factory) {
        LinearRing shell = ring(rings.get(0), factory);
        LinearRing[] holes = new LinearRing[Math.max(0, rings.size() - 1)];
        for (int i = 1; i < rings.size(); i++) holes[i - 1] = ring(rings.get(i), factory);
        return factory.createPolygon(shell, holes);
    }

    private static LinearRing ring(JsonNode points, GeometryFactory factory) {
        List<Coordinate> coordinates = new ArrayList<>(points.size() + 1);
        points.forEach(point -> coordinates.add(new Coordinate(point.get(0).asDouble(), point.get(1).asDouble())));
        if (!coordinates.getFirst().equals2D(coordinates.getLast())) coordinates.add(coordinates.getFirst().copy());
        return factory.createLinearRing(coordinates.toArray(Coordinate[]::new));
    }

    private static List<List<List<BigDecimal>>> rings(Polygon polygon) {
        List<List<List<BigDecimal>>> rings = new ArrayList<>();
        rings.add(points(polygon.getExteriorRing().getCoordinates()));
        for (int i = 0; i < polygon.getNumInteriorRing(); i++) {
            rings.add(points(polygon.getInteriorRingN(i).getCoordinates()));
        }
        return rings;
    }

    private static List<List<BigDecimal>> points(Coordinate[] coordinates) {
        List<List<BigDecimal>> points = new ArrayList<>(coordinates.length);
        for (Coordinate c : coordinates) points.add(List.of(round(c.x), round(c.y)));
        return points;
    }

    private static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(DECIMALS, RoundingMode.HALF_UP).stripTrailingZeros();
    }
}
