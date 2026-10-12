package com.clenzy.marketplace.sectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/** Contours réels de {@code geo/baitly-sectors.geojson} : aucune donnée simulée. */
class SectorShapesTest {

    private static SectorGeometryCatalog catalog;
    private static SectorShapes shapes;

    @BeforeAll
    static void loadCatalog() {
        catalog = new SectorGeometryCatalog(new ObjectMapper());
        shapes = new SectorShapes(catalog);
    }

    private static SectorShapes.DeclaredZone fr(String department, String arrondissement) {
        return new SectorShapes.DeclaredZone("FR", department, arrondissement, null);
    }

    private static boolean contains(Geometry geometry, double lng, double lat) {
        return geometry.contains(catalog.factory().createPoint(new Coordinate(lng, lat)));
    }

    @Test
    void whenTheCatalogLoads_thenEveryDeclarableSectorHasAContour() {
        assertThat(catalog.find("FR", "75", null, null)).isPresent();
        assertThat(catalog.find("FR", "2A", null, null)).isPresent();
        assertThat(catalog.find("FR", "974", null, null)).isPresent();
        assertThat(catalog.find("FR", "69", "69383", null)).isPresent();
        assertThat(catalog.find("MA", null, null, "Casablanca")).isPresent();
        assertThat(catalog.find("SA", null, null, "Riyad")).isPresent();
        assertThat(catalog.attribution()).contains("IGN").contains("OpenStreetMap");
    }

    @Test
    void whenACityIsTypedWithAnotherSpelling_thenItsAliasResolvesTheSameContour() {
        assertThat(catalog.find("MA", null, null, "Fès")).map(SectorGeometryCatalog.Sector::key).contains("MA-C-fes");
        assertThat(catalog.find("SA", null, null, "Riyadh")).map(SectorGeometryCatalog.Sector::key).contains("SA-C-riyad");
    }

    @Test
    void whenAllParisArrondissementsAreDeclared_thenTheyMergeIntoOneSectorShapedLikeParis() {
        var arrondissements = IntStream.rangeClosed(1, 20)
                .mapToObj(n -> fr("75", "751" + String.format("%02d", n))).toList();

        var shape = shapes.provider(1L, "Ménage Paris", arrondissements);

        assertThat(shape.geometry().getNumGeometries()).isEqualTo(1);
        double parisArea = catalog.find("FR", "75", null, null).orElseThrow().geometry().getArea();
        assertThat(shape.geometry().getArea()).isCloseTo(parisArea, org.assertj.core.data.Percentage.withPercentage(3));
        assertThat(shape.sectors().geometry()).containsEntry("type", "Polygon");
    }

    @Test
    void whenNeighbouringDepartmentsBelongToTwoProviders_thenTheMergedViewHasOneBorder() {
        var paris = shapes.provider(1L, "A", List.of(fr("75", null)));
        var seineSaintDenis = shapes.provider(2L, "B", List.of(fr("93", null)));

        var map = shapes.map(List.of(paris, seineSaintDenis), List.of());

        assertThat(map.providers()).hasSize(2);
        assertThat(map.merged()).containsEntry("type", "Polygon");
    }

    @Test
    void whenAZoneHasNoKnownContour_thenItIsListedButNotDrawn() {
        var shape = shapes.provider(1L, "A", List.of(
                new SectorShapes.DeclaredZone("MA", null, null, "Ifrane"), fr("13", null)));

        assertThat(shape.sectors().zones()).extracting(SectorMapDto.Zone::drawn).containsExactly(false, true);
        assertThat(contains(shape.geometry(), 5.37, 43.30)).isTrue(); // Marseille
    }

    @Test
    void whenNoZoneIsDrawable_thenTheSectorHasNoGeometry() {
        var shape = shapes.provider(1L, "A", List.of(new SectorShapes.DeclaredZone("MA", null, null, "Ifrane")));

        assertThat(shape.geometry()).isNull();
        assertThat(shapes.map(List.of(shape), List.of()).merged()).isNull();
    }

    @Test
    void whenAnArrondissementIsDeclared_thenItsContourDoesNotSpillOverTheWholeCity() {
        var shape = shapes.provider(1L, "A", List.of(fr("75", "75111")));

        assertThat(contains(shape.geometry(), 2.3800, 48.8590)).isTrue();   // Paris 11e
        assertThat(contains(shape.geometry(), 2.2945, 48.8584)).isFalse();  // Tour Eiffel, 7e
    }
}
