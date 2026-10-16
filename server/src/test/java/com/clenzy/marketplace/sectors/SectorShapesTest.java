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

    @Test void aFrenchCityDrawsOnlyItsMunicipalBoundaryAndKeepsDepartmentCoverageAvailable() {
        var city = shapes.provider(27L, "Courbevoie", List.of(new SectorShapes.DeclaredZone("FR", "92", null, "Courbevoie")));
        assertThat(contains(city.geometry(), 2.256, 48.897)).isTrue();
        assertThat(contains(city.geometry(), 2.241, 48.884)).isFalse(); // Neuilly-sur-Seine
        assertThat(city.geometry().getArea()).isLessThan(catalog.find("FR", "92", null, null).orElseThrow().geometry().getArea() / 10);
        assertThat(catalog.find("FR", "92", null, "Neuilly sur Seine")).isPresent();
        assertThat(catalog.find("FR", "93", null, "Courbevoie")).isEmpty();
        assertThat(catalog.find("FR", "92", null, "Ville inconnue")).isEmpty();
        var department = shapes.provider(27L, "Tout le 92", List.of(fr("92", null)));
        assertThat(contains(department.geometry(), 2.241, 48.884)).isTrue();
    }

    @Test void radiusOutlineUsesTheGeolocatedBaseAndJoinsDeclaredDepartments() {
        var radius=new SectorShapes.DeclaredZone("FR",null,null,"Paris",48.8566,2.3522,10);
        var shape=shapes.provider(1L,"A",List.of(radius));
        assertThat(contains(shape.geometry(),2.3522,48.8566)).isTrue();
        assertThat(contains(shape.geometry(),2.448,48.863)).isTrue();
        assertThat(contains(shape.geometry(),4.84,45.76)).isFalse();
        var union=shapes.provider(1L,"A",List.of(radius,fr("69",null)));
        assertThat(contains(union.geometry(),4.84,45.76)).isTrue();
        assertThat(contains(union.geometry(),2.3522,48.8566)).isTrue();
    }

    @Test void zeroRadiusDoesNotDrawTheWholeBaseCity() {
        var radius=new SectorShapes.DeclaredZone("FR",null,null,"Paris",48.8566,2.3522,0);
        var shape=shapes.provider(1L,"A",List.of(radius));
        assertThat(shape.geometry()).isNull();
        assertThat(shape.sectors().zones()).extracting(SectorMapDto.Zone::kind).containsExactly("radius");
    }

    @Test
    void whenTheSameZonesComeBack_thenTheUnionsAreReusedNotRecomputed() {
        var first = shapes.provider(1L, "A", List.of(fr("75", null), fr("93", null)));
        var again = shapes.provider(7L, "Autre prestataire", List.of(fr("75", null), fr("93", null)));

        assertThat(again.geometry()).isSameAs(first.geometry());
        assertThat(again.sectors().providerId()).isEqualTo(7L);
        assertThat(again.sectors().name()).isEqualTo("Autre prestataire");
        var map = shapes.map(List.of(first), List.of());
        assertThat(shapes.map(List.of(again), List.of()).merged()).isSameAs(map.merged());
    }

    @Test
    void whenTheZonesChange_thenANewUnionIsComputed() {
        var paris = shapes.provider(1L, "A", List.of(fr("75", null)));
        var larger = shapes.provider(1L, "A", List.of(fr("75", null), fr("93", null)));

        assertThat(larger.geometry()).isNotSameAs(paris.geometry());
        assertThat(larger.geometry().getArea()).isGreaterThan(paris.geometry().getArea());
    }
}
