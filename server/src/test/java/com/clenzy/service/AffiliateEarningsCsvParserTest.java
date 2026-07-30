package com.clenzy.service;

import com.clenzy.dto.ImportAffiliateEarningRequest;
import com.clenzy.model.ActivityProvider;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AffiliateEarningsCsvParserTest {

    private final AffiliateEarningsCsvParser parser = new AffiliateEarningsCsvParser();

    @Test
    void parsesAngloSaxonExport_commaSeparatedWithDotDecimals() {
        String csv = """
            Booking Reference,Commission,Currency
            VT-1001,24.50,EUR
            VT-1002,10.00,EUR
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.VIATOR);

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).externalBookingId()).isEqualTo("VT-1001");
        assertThat(rows.get(0).grossCommission()).isEqualByComparingTo("24.50");
        assertThat(rows.get(0).currency()).isEqualTo("EUR");
        assertThat(rows.get(0).provider()).isEqualTo(ActivityProvider.VIATOR);
    }

    @Test
    void parsesEuropeanExport_semicolonSeparatedWithCommaDecimals() {
        String csv = """
            Référence de réservation;Montant commission;Devise
            GYG-77;1 234,56;EUR
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.GETYOURGUIDE);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).externalBookingId()).isEqualTo("GYG-77");
        assertThat(rows.get(0).grossCommission()).isEqualByComparingTo("1234.56");
    }

    @Test
    void ignoresAccentsCaseAndPunctuationInHeaders() {
        String csv = """
            "Booking Ref.","Commission Amount"
            KL-5,8.20
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.KLOOK);

        assertThat(rows).singleElement()
            .satisfies(r -> assertThat(r.externalBookingId()).isEqualTo("KL-5"));
    }

    @Test
    void keepsSeparatorsFoundInsideQuotedCells() {
        String csv = """
            Reference,Commission,Currency
            "VT-1, bis",12.00,EUR
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.VIATOR);

        assertThat(rows).singleElement()
            .satisfies(r -> assertThat(r.externalBookingId()).isEqualTo("VT-1, bis"));
    }

    @Test
    void skipsTotalsAndPendingRows_ratherThanFailingTheWholeFile() {
        // Les exports portent des lignes de total et des conversions en attente :
        // elles n'ont rien a crediter, mais ne doivent pas faire echouer l'import.
        String csv = """
            Reference,Commission,Currency
            VT-1,10.00,EUR
            ,25.00,EUR
            VT-2,,EUR
            VT-3,0.00,EUR
            TOTAL,35.00,EUR
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.VIATOR);

        assertThat(rows).extracting(ImportAffiliateEarningRequest::externalBookingId)
            .containsExactly("VT-1", "TOTAL");
    }

    @Test
    void readsOptionalPropertyColumn_whenTheExportCarriesIt() {
        String csv = """
            Reference,Commission,Currency,Property ID
            VT-9,15.00,EUR,42
            """;

        List<ImportAffiliateEarningRequest> rows = parser.parse(csv, ActivityProvider.VIATOR);

        assertThat(rows).singleElement()
            .satisfies(r -> assertThat(r.propertyId()).isEqualTo(42L));
    }

    @Test
    void failsLoudly_whenRequiredColumnsAreMissing() {
        String csv = """
            Date,Clicks
            2026-01-01,120
            """;

        assertThatThrownBy(() -> parser.parse(csv, ActivityProvider.VIATOR))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Colonnes introuvables");
    }

    @Test
    void failsLoudly_onEmptyFile() {
        assertThatThrownBy(() -> parser.parse("", ActivityProvider.VIATOR))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
