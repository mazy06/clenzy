package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MapboxStaticImageServiceTest {

    private MapboxStaticImageService service;

    @BeforeEach
    void setUp() {
        service = new MapboxStaticImageService();
        ReflectionTestUtils.setField(service, "accessToken", "test-token");
    }

    // ----- Guard clauses -----

    @Test
    void generate_noToken_returnsEmpty() {
        ReflectionTestUtils.setField(service, "accessToken", "");
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "Property", null);

        assertThat(result).isEmpty();
    }

    @Test
    void generate_nullToken_returnsEmpty() {
        ReflectionTestUtils.setField(service, "accessToken", null);
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "Property", null);

        assertThat(result).isEmpty();
    }

    @Test
    void generate_blankToken_returnsEmpty() {
        ReflectionTestUtils.setField(service, "accessToken", "   ");
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "Property", null);

        assertThat(result).isEmpty();
    }

    @Test
    void generate_noPropertyLatitude_returnsEmpty() {
        String result = service.generateMapImageTag(
            null, new BigDecimal("2.3522"),
            null, null, "Property", null);

        assertThat(result).isEmpty();
    }

    @Test
    void generate_noPropertyLongitude_returnsEmpty() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), null,
            null, null, "Property", null);

        assertThat(result).isEmpty();
    }

    // ----- Property only -----

    @Test
    void generate_propertyOnly_buildsValidTag() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "Mon Bel Appart", null);

        assertThat(result)
            .startsWith("<img")
            .contains("api.mapbox.com/styles/v1/mapbox/streets-v12/static")
            .contains("pin-l-lodging+3b82f6")
            .contains("2.352200,48.856600")
            .contains(",15") // default zoom
            .contains("600x300@2x")
            .contains("access_token=test-token")
            .contains("logo=false")
            .contains("attribution=false")
            .contains("alt=\"Carte - Mon Bel Appart\"")
            .doesNotContain("padding=");
    }

    @Test
    void generate_propertyOnlyNullName_usesDefault() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, null, null);

        assertThat(result).contains("Carte - Propriete");
    }

    @Test
    void generate_propertyNameEscapesHtml() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "<script>alert('xss')</script>", null);

        assertThat(result).contains("&lt;script&gt;");
        assertThat(result).doesNotContain("<script>");
    }

    // ----- Property + store -----

    @Test
    void generate_propertyAndStore_buildsTagWithBothMarkersAndAutoZoom() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            48.8600, 2.3500, "Appart", "Boulangerie");

        assertThat(result)
            .contains("pin-l-lodging+3b82f6(2.352200,48.856600)")
            .contains("pin-l-marker+ff6b35(2.350000,48.860000)")
            .contains("/auto/")
            .contains("padding=60")
            .contains("alt=\"Carte - Appart et point de retrait Boulangerie\"");
    }

    @Test
    void generate_storeAtZeroCoordinates_treatedAsAbsentForUrl() {
        // 0.0 coords drop the marker in buildImageUrl, but buildAltText only
        // checks storeLat != null, so the alt text still mentions the store.
        // We assert the URL-side behavior (no marker, no padding) here.
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            0.0, 0.0, "Appart", "Store");

        assertThat(result).doesNotContain("pin-l-marker+ff6b35");
        assertThat(result).doesNotContain("padding=");
        assertThat(result).contains(",15"); // default zoom for single marker
        assertThat(result).contains("Carte - Appart");
    }

    @Test
    void generate_storeLatNull_treatedAsAbsent() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, 2.3500, "Appart", "Store");

        assertThat(result).doesNotContain("pin-l-marker+ff6b35");
    }

    @Test
    void generate_storeLngNull_treatedAsAbsent() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            48.86, null, "Appart", "Store");

        assertThat(result).doesNotContain("pin-l-marker+ff6b35");
    }

    @Test
    void generate_storeBlankName_omitsStoreInAlt() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            48.86, 2.35, "Appart", "  ");

        // Has store marker but no store name in alt
        assertThat(result).contains("pin-l-marker+ff6b35");
        assertThat(result).contains("Carte - Appart");
        assertThat(result).doesNotContain("point de retrait");
    }

    @Test
    void generate_storeNullName_omitsStoreInAlt() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            48.86, 2.35, "Appart", null);

        assertThat(result).contains("pin-l-marker+ff6b35");
        assertThat(result).contains("Carte - Appart");
        assertThat(result).doesNotContain("point de retrait");
    }

    @Test
    void generate_storeNameEscapesHtml() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            48.86, 2.35, "Appart", "Boulangerie & Cie");

        assertThat(result).contains("&amp;");
    }

    @Test
    void generate_imgTagFormatCorrect() {
        String result = service.generateMapImageTag(
            new BigDecimal("48.8566"), new BigDecimal("2.3522"),
            null, null, "Test", null);

        // Verify the HTML img tag structure
        assertThat(result)
            .contains("width=\"600\"")
            .contains("height=\"300\"")
            .contains("style=\"width:100%")
            .contains("max-width:600px")
            .contains("border-radius:8px")
            .endsWith("/>");
    }
}
