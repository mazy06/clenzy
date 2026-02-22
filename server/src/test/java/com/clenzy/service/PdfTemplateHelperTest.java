package com.clenzy.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link PdfTemplateHelper}.
 * Validates static utility methods: formatting, cell creation, table creation.
 */
class PdfTemplateHelperTest {

    @Nested
    @DisplayName("formatCurrency")
    class FormatCurrency {

        @Test
        void whenNullAmount_thenReturnsDefault() {
            assertThat(PdfTemplateHelper.formatCurrency(null)).isEqualTo("€0,00");
        }

        @Test
        void whenWholeNumber_thenFormatsWithDecimals() {
            assertThat(PdfTemplateHelper.formatCurrency(BigDecimal.valueOf(100)))
                    .isEqualTo("€100,00");
        }

        @Test
        void whenDecimalNumber_thenFormatsCorrectly() {
            assertThat(PdfTemplateHelper.formatCurrency(BigDecimal.valueOf(1234.56)))
                    .isEqualTo("€1234,56");
        }

        @Test
        void whenZero_thenFormatsCorrectly() {
            assertThat(PdfTemplateHelper.formatCurrency(BigDecimal.ZERO))
                    .isEqualTo("€0,00");
        }

        @Test
        void whenHighPrecision_thenRoundsToTwoDecimals() {
            assertThat(PdfTemplateHelper.formatCurrency(BigDecimal.valueOf(99.999)))
                    .isEqualTo("€100,00");
        }
    }

    @Nested
    @DisplayName("formatDate")
    class FormatDate {

        @Test
        void whenNullDate_thenReturnsDash() {
            assertThat(PdfTemplateHelper.formatDate(null)).isEqualTo("-");
        }

        @Test
        void whenValidDate_thenFormatsAsDDMMYYYY() {
            assertThat(PdfTemplateHelper.formatDate(LocalDate.of(2026, 3, 15)))
                    .isEqualTo("15/03/2026");
        }

        @Test
        void whenJanuaryFirstDate_thenFormatsCorrectly() {
            assertThat(PdfTemplateHelper.formatDate(LocalDate.of(2026, 1, 1)))
                    .isEqualTo("01/01/2026");
        }
    }

    @Nested
    @DisplayName("formatPercentage")
    class FormatPercentage {

        @Test
        void whenZero_thenFormatsCorrectly() {
            assertThat(PdfTemplateHelper.formatPercentage(0.0)).isEqualTo("0,00%");
        }

        @Test
        void whenHundred_thenFormatsCorrectly() {
            assertThat(PdfTemplateHelper.formatPercentage(100.0)).isEqualTo("100,00%");
        }

        @Test
        void whenDecimalValue_thenFormatsWithComma() {
            assertThat(PdfTemplateHelper.formatPercentage(85.75)).isEqualTo("85,75%");
        }
    }

    @Nested
    @DisplayName("createStyledTable")
    class CreateStyledTable {

        @Test
        void whenCreated_thenReturnsNonNull() {
            var table = PdfTemplateHelper.createStyledTable(new float[]{1, 2, 1});
            assertThat(table).isNotNull();
        }
    }

    @Nested
    @DisplayName("createHeaderCell")
    class CreateHeaderCell {

        @Test
        void whenCreated_thenReturnsNonNull() {
            var cell = PdfTemplateHelper.createHeaderCell("Header");
            assertThat(cell).isNotNull();
        }
    }

    @Nested
    @DisplayName("createDataCell")
    class CreateDataCell {

        @Test
        void whenCreatedWithText_thenReturnsNonNull() {
            var cell = PdfTemplateHelper.createDataCell("Data");
            assertThat(cell).isNotNull();
        }

        @Test
        void whenCreatedWithAlignment_thenReturnsNonNull() {
            var cell = PdfTemplateHelper.createDataCell("Data",
                    com.itextpdf.layout.properties.TextAlignment.RIGHT);
            assertThat(cell).isNotNull();
        }
    }
}
