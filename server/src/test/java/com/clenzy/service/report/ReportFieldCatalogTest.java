package com.clenzy.service.report;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Whitelist anti-injection des champs de rapport (CLZ-P0-15).
 */
class ReportFieldCatalogTest {

    private final ReportFieldCatalog catalog = new ReportFieldCatalog();

    @Test
    void acceptsWhitelistedFields() {
        assertThatCode(() -> catalog.validate(List.of("PROPERTY", "country"), List.of("REVENUE"), "MONTH"))
            .doesNotThrowAnyException();
    }

    @Test
    void rejectsUnknownDimension() {
        assertThatThrownBy(() -> catalog.validate(List.of("PROPERTY", "DROP_TABLE"), List.of("REVENUE"), "MONTH"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnknownMetric() {
        assertThatThrownBy(() -> catalog.validate(List.of("PROPERTY"), List.of("REVENUE", "secret"), "MONTH"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsEmptyDimensions() {
        assertThatThrownBy(() -> catalog.validate(List.of(), List.of("REVENUE"), "MONTH"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnknownGranularity() {
        assertThatThrownBy(() -> catalog.validate(List.of("PROPERTY"), List.of("REVENUE"), "HOURLY"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
