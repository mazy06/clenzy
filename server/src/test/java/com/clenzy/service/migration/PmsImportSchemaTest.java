package com.clenzy.service.migration;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class PmsImportSchemaTest {
    @Test void datesAreStrictAndNeverGuessDayMonthOrder() {
        assertThat(PmsImportSchema.date("03/04/2026", "DMY")).isEqualTo(LocalDate.of(2026, 4, 3));
        assertThat(PmsImportSchema.date("03/04/2026", "MDY")).isEqualTo(LocalDate.of(2026, 3, 4));
        assertThat(PmsImportSchema.date("٢٠٢٦-١٠-٠٣", "ISO")).isEqualTo(LocalDate.of(2026, 10, 3));
        assertThatThrownBy(() -> PmsImportSchema.date("31/02/2026", "DMY")).hasMessageStartingWith("DATE:");
        assertThatThrownBy(() -> PmsImportSchema.date("2026-10-03T23:00:00Z", "ISO")).hasMessageStartingWith("DATE:");
    }
    @Test void excel1900SerialDatesRespectLeapYearBugAndRefuseTruncatedTimes() {
        assertThat(PmsImportSchema.date("46298", "EXCEL_1900")).isEqualTo(LocalDate.of(2026, 10, 3));
        assertThatThrownBy(() -> PmsImportSchema.date("60", "EXCEL_1900")).hasMessageStartingWith("DATE:");
        assertThatThrownBy(() -> PmsImportSchema.date("46298.5", "EXCEL_1900")).hasMessageStartingWith("DATE:");
    }
    @Test void exactMoneyPreservesCentsAndArabicDigitsRejectsAmbiguousFormats() {
        assertThat(PmsImportSchema.money("1\u202F234,56", ",")).isEqualByComparingTo("1234.56");
        assertThat(PmsImportSchema.money("١٢٣٤٫٥٦", ".")).isEqualByComparingTo("1234.56");
        for (String bad : List.of("1,234.56", "12.345", "-10", "=1+1", "1e3", "100000000"))
            assertThatThrownBy(() -> PmsImportSchema.money(bad, ".")).hasMessageStartingWith("MONEY:");
    }
    @Test void ambiguousAliasesAreLeftUnmapped() {
        var doc = new ImportDocument("a", "bookings", List.of("id", "booking id", "arrival"), List.of(), null);
        assertThat(PmsImportSchema.suggest(doc).fields()).containsEntry("checkIn", "arrival").doesNotContainKey("sourceId");
    }
    @Test void unknownColumnsArePreservedAndRequiredDataNotInvented() {
        var row = Map.of("first name", "Salma", "last name", "Alaoui", "custom", "VIP");
        var doc = new ImportDocument("a", "guests", new ArrayList<>(row.keySet()), List.of(row), null);
        var plan = PmsImportSchema.suggest(doc);
        assertThatThrownBy(() -> PmsImportSchema.map(row, plan)).hasMessage("REQUIRED:sourceId");
        assertThat(row).containsEntry("custom", "VIP");
    }
}
