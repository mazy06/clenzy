package com.clenzy.service.report;

import com.clenzy.dto.report.*;
import com.clenzy.service.report.snapshot.ReportAnonymiser;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le dossier prospect ne doit nommer personne.
 *
 * <p>Diffuser les revenus d'un proprietaire nomme a un tiers avec qui aucun
 * contrat n'existe encore est une fuite de donnees. Ces tests verifient que le
 * nom disparait PARTOUT — page de garde, tableaux, axes, constats, commentaire —
 * et que les montants, eux, restent : ce sont eux qui font la preuve.</p>
 */
class ReportAnonymiserTest {

    @Test
    void whenTheProfileIsProspect_thenNoPropertyNameSurvivesAnywhere() {
        final ReportSnapshot anonymous = ReportAnonymiser.anonymise(snapshot(ReportProfile.PROSPECT));

        final String everything = dump(anonymous);
        assertThat(everything).doesNotContain("Villa Caudéran");
        assertThat(everything).doesNotContain("Duplex Croisette");
        assertThat(everything).contains("Bien 1", "Bien 2");
    }

    @Test
    void whenTheProfileIsProspect_thenTheFiguresAreKept() {
        final ReportSnapshot anonymous = ReportAnonymiser.anonymise(snapshot(ReportProfile.PROSPECT));

        // La performance est ce que le dossier demontre : elle ne s'anonymise pas.
        assertThat(dump(anonymous)).contains("7 465,21 €", "62 %");
    }

    @Test
    void whenTheProfileIsOwner_thenNothingIsTouched() {
        final ReportSnapshot owner = snapshot(ReportProfile.OWNER);

        assertThat(dump(ReportAnonymiser.anonymise(owner))).isEqualTo(dump(owner));
    }

    @Test
    void whenALongNameContainsAShorterOne_thenTheLongestWins() {
        // « Duplex » remplace avant « Duplex Croisette » laisserait « Bien 3
        // Croisette » : le nom resterait lisible a moitie.
        final ReportSnapshot anonymous = ReportAnonymiser.anonymise(snapshot(ReportProfile.PROSPECT));

        assertThat(dump(anonymous)).doesNotContain("Croisette");
    }

    private String dump(ReportSnapshot snapshot) {
        final StringBuilder text = new StringBuilder(String.join("|", snapshot.meta().scopeLabels()));
        for (ReportSection section : snapshot.sections()) {
            text.append('|').append(section.body()).append('|').append(section.narrative());
            if (section.table() != null) {
                section.table().rows().forEach(row -> text.append('|').append(String.join("|", row)));
                text.append('|').append(String.join("|", section.table().totals()));
            }
            if (section.chart() != null) {
                text.append('|').append(String.join("|", section.chart().categories()));
            }
            section.notes().forEach(note -> text.append('|').append(note.label())
                    .append('|').append(note.detail()).append('|').append(note.impact()));
        }
        return text.toString();
    }

    private ReportSnapshot snapshot(ReportProfile profile) {
        final ReportMeta meta = new ReportMeta("R-1", 1, profile, "Dossier",
                "Conciergerie", null, "Prospect SA",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31),
                LocalDate.of(2025, 8, 1), LocalDate.of(2025, 8, 31),
                Instant.now(), "EUR",
                List.of("Villa Caudéran", "Duplex Croisette"), null);

        final ReportSection section = new ReportSection("properties", "Détail par bien", null,
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Bien", "Revenus", "Occupation"),
                        ReportTable.numericAligns(3),
                        List.of(List.of("Villa Caudéran", "7 465,21 €", "62 %"),
                                List.of("Duplex Croisette", "8 397,50 €", "52,2 %")),
                        List.of("Total", "15 862,71 €", "57,1 %")),
                new ReportChart(ReportChartType.HORIZONTAL_BARS,
                        List.of("Villa Caudéran", "Duplex Croisette"),
                        List.of(ReportSeries.of("r", "Revenus",
                                List.of(new BigDecimal("7465.21"), new BigDecimal("8397.50")))),
                        "money"),
                List.of(ReportNote.positive("Meilleure contribution", "Duplex Croisette")
                        .withImpact("8 397,50 €")),
                "Le bien Villa Caudéran porte l'essentiel.",
                "Villa Caudéran progresse nettement.");

        return new ReportSnapshot(meta, List.of(), List.of(section));
    }
}
