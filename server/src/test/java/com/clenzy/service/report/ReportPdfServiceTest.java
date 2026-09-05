package com.clenzy.service.report;

import com.clenzy.dto.report.*;
import com.clenzy.service.report.render.ReportHtmlRenderer;
import com.clenzy.service.report.render.ReportPdfService;
import com.clenzy.service.report.render.ReportLogoResolver;
import com.clenzy.service.report.render.SvgChartRenderer;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Epreuve du rendu PDF.
 *
 * <p>iText {@code html2pdf} etait declare dans le pom mais n'etait employe nulle
 * part : le chemin HTML → PDF avec SVG integre n'avait jamais tourne. Ce test
 * le fait tourner a chaque build, avec UNE forme de graphique de chaque type —
 * une seule d'entre elles qui casserait ferait tomber le document entier, et
 * l'echec ne se verrait qu'a l'envoi.</p>
 */
class ReportPdfServiceTest {

    private final ReportPdfService pdfService = new ReportPdfService(
            new ReportHtmlRenderer(new SvgChartRenderer(), new ReportLogoResolver()));

    @Test
    void whenRenderingAFullSnapshot_thenAValidPdfIsProduced() throws IOException {
        final byte[] pdf = pdfService.toPdf(everyKindSnapshot(), narrative(), false);

        // Un exemplaire sur disque a chaque build : la mise en page d'un document
        // ne se relit pas dans du code, elle se regarde. `target/` est un
        // repertoire de build, jamais versionne.
        Files.write(Path.of("target", "report-sample.pdf"), pdf);

        assertThat(pdf).isNotEmpty();
        // Signature du format : sans elle, on aurait un flux d'octets quelconque.
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
        // Un document qui porte cinq graphiques et quatre tableaux pese bien plus
        // que quelques kilo-octets ; un PDF ridiculement petit signalerait un
        // rendu vide que la signature seule ne detecterait pas.
        assertThat(pdf.length).isGreaterThan(8_000);
    }

    @Test
    void whenTheReportIsADraft_thenTheWatermarkIsPresent() {
        final String html = pdfService.toHtml(fullSnapshot(), narrative(), true);

        assertThat(html).contains("BROUILLON");
        assertThat(pdfService.toPdf(fullSnapshot(), narrative(), true)).isNotEmpty();
    }

    @Test
    void whenAPropertyNameCarriesMarkup_thenTheDocumentStillRenders() {
        // Un nom de bien contenant « & » ou « < » non echappe casse le document
        // ENTIER, pas seulement sa cellule : le rendu s'arrete sur le XML invalide.
        final ReportSnapshot snapshot = snapshotWith("Loft <Bastille> & Cie");

        final byte[] pdf = pdfService.toPdf(snapshot, ReportNarrative.empty(), false);

        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }

    @Test
    void whenTheSnapshotHasNoNarrative_thenTheDocumentIsStillComplete() {
        // Un agent indisponible ne doit jamais empecher la production du releve.
        final byte[] pdf = pdfService.toPdf(fullSnapshot(), ReportNarrative.empty(), false);

        assertThat(pdf.length).isGreaterThan(8_000);
    }

    /**
     * Le PDF porte TOUT le snapshot.
     *
     * <p>L'apercu a l'ecran et le document imprime lisent la meme source, mais
     * rien ne garantissait qu'ils en rendent autant : une section dont le type
     * n'aurait pas ete traite par le gabarit aurait disparu du PDF en silence,
     * et l'ecart ne se serait vu qu'a la reception. Ce test compare le texte
     * EXTRAIT du PDF au contenu du snapshot, titre par titre et total par
     * total.</p>
     */
    @Test
    void whenRenderingASnapshot_thenEverySectionAndTotalReachesThePdf() throws IOException {
        final ReportSnapshot snapshot = everyKindSnapshot();

        final String text = extractText(pdfService.toPdf(snapshot, narrative(), false));

        for (ReportSection section : snapshot.sections()) {
            assertThat(text)
                    .as("la section « %s » doit figurer dans le PDF", section.title())
                    .contains(section.title());
            if (section.table() != null) {
                for (String total : section.table().totals()) {
                    if (!total.isBlank()) {
                        assertThat(text)
                                .as("le total « %s » de la section « %s »", total, section.title())
                                .contains(total);
                    }
                }
            }
            for (ReportNote note : section.notes()) {
                assertThat(text)
                        .as("le constat « %s »", note.label())
                        .contains(note.label());
                if (note.impact() != null) {
                    // Le montant doit arriver ENTIER. Avec `float: right`, iText
                    // coupait « 9 294,32 € » a son separateur de milliers et
                    // imprimait « 294,32 €⁹ » — un chiffre faux, que la seule
                    // presence du libelle ne revelait pas.
                    assertThat(text)
                            .as("le montant « %s » du constat « %s »", note.impact(), note.label())
                            .contains(normalise(note.impact()));
                }
            }
        }
        for (ReportKpi kpi : snapshot.kpis()) {
            assertThat(text).as("le chiffre cle « %s »", kpi.label()).contains(kpi.label());
        }
    }

    /** Espaces insecables ramenes a des espaces ordinaires, comme a l'extraction. */
    private static String normalise(String value) {
        return value.replace('\u00A0', ' ').replace('\u202F', ' ');
    }

    private String extractText(byte[] pdf) throws IOException {
        final StringBuilder text = new StringBuilder();
        try (PdfDocument document = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf)))) {
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                text.append(PdfTextExtractor.getTextFromPage(document.getPage(page))).append('\n');
            }
        }
        // Les espaces insecables des montants deviennent des espaces ordinaires
        // a l'extraction : on aligne les deux cotes de la comparaison.
        return text.toString().replace('\u00A0', ' ').replace('\u202F', ' ');
    }

    /** Un snapshot portant les HUIT types de section, chacun avec sa matiere. */
    private ReportSnapshot everyKindSnapshot() {
        final ReportSnapshot base = fullSnapshot();
        final List<ReportSection> sections = new java.util.ArrayList<>(base.sections());

        // Les sections ajoutees en dernier : leur mise en page n'avait jamais
        // ete rendue, et c'est la que les surprises se logent.
        sections.add(0, new ReportSection("highlights", "Faits marquants",
                "Ce qui a bougé sur la période",
                ReportSectionKind.LIST, null, null,
                List.of(ReportNote.warning("Occupation sous la cible", "23,9 % contre 60 %")
                                .withImpact("236 nuits"),
                        ReportNote.positive("Revenus en hausse", "sur un an").withImpact("9 294,32 €")),
                null, null));

        sections.add(new ReportSection("pricing", "Positionnement tarifaire",
                "Prix moyen et remplissage lus ensemble",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Mois", "Prix moyen", "Occupation", "Lecture"),
                        List.of(ReportAlign.START, ReportAlign.END, ReportAlign.END, ReportAlign.START),
                        List.of(List.of("juil. 26", "137,80 €", "91,2 %", "Rempli — le tarif pouvait monter"),
                                List.of("aout 26", "141,09 €", "23,9 %",
                                        "Sous-rempli — tarif ou visibilité à revoir")),
                        List.of()),
                new ReportChart(ReportChartType.LINES, List.of("juil. 26", "aout 26"),
                        List.of(ReportSeries.of("adr", "Prix moyen",
                                List.of(new BigDecimal("137.80"), new BigDecimal("141.09")))),
                        "money"),
                List.of(), null, null));

        sections.add(new ReportSection("seasonality", "Saisonnalité",
                "Moyenne par mois de l'année",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Mois", "Revenus moyens", "Occupation moyenne", "Années"),
                        ReportTable.numericAligns(4),
                        List.of(List.of("janvier", "3 100,00 €", "31,2 %", "2"),
                                List.of("août", "10 197,57 €", "62,4 %", "2")),
                        List.of()),
                new ReportChart(ReportChartType.BARS, List.of("janvier", "août"),
                        List.of(ReportSeries.of("r", "Revenus moyens",
                                List.of(new BigDecimal("3100"), new BigDecimal("10197")))),
                        "money"),
                List.of(), null, null));

        sections.add(new ReportSection("leadtime", "Délai de réservation",
                "Combien de jours à l'avance les voyageurs réservent",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Délai", "Réservations", "Part"),
                        ReportTable.numericAligns(3),
                        List.of(List.of("Moins de 8 jours", "42", "32,6 %"),
                                List.of("8 à 30 jours", "51", "39,5 %")),
                        List.of("Total", "129", "100 %")),
                new ReportChart(ReportChartType.HORIZONTAL_BARS,
                        List.of("Moins de 8 jours", "8 à 30 jours", "Plus de 90 jours"),
                        List.of(ReportSeries.of("c", "Réservations",
                                List.of(new BigDecimal("42"), new BigDecimal("51"),
                                        new BigDecimal("36")))),
                        "count"),
                List.of(ReportNote.neutral("Délai médian", "La moitié des séjours").withImpact("18 jours")),
                null, null));

        sections.add(new ReportSection("expenses", "Détail des charges",
                "Chaque intervention facturée",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Date", "Bien", "Nature", "Montant", "Coût"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.START,
                                ReportAlign.START, ReportAlign.END),
                        List.of(List.of("04/08/2026", "Villa", "Réparation Climatisation",
                                "Constaté", "270,00 €")),
                        List.of("Total", "", "", "", "2 171,79 €")),
                null,
                List.of(ReportNote.warning("Coûts encore estimés", "devis, non facture")
                        .withImpact("3 sur 17")),
                null, null));

        sections.add(new ReportSection("benchmark", "Comparaison entre biens",
                "Chaque logement face à la moyenne",
                ReportSectionKind.TABLE,
                new ReportTable(
                        List.of("Bien", "Revenus", "vs moyenne", "Occupation", "Écart", "Marge"),
                        ReportTable.numericAligns(6),
                        List.of(List.of("Maison Plumereau", "9 294,32 €", "+18,4 %", "62 %",
                                "+6,3 %", "6 281,00 €")),
                        List.of()),
                null,
                List.of(ReportNote.neutral("Moyenne du portefeuille", "55,7 % d'occupation")
                        .withImpact("7 851,20 €")),
                null, null));

        sections.add(new ReportSection("stays", "Detail des sejours", "Chaque reservation",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Arrivee", "Bien", "Montant"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.END),
                        List.of(List.of("01/08/2026", "Villa", "700,00 EUR")),
                        List.of("Total", "", "700,00 EUR")),
                null, List.of(), null, null));

        sections.add(new ReportSection("decisions", "Ce qu il faut decider", "Actions",
                ReportSectionKind.LIST,
                new ReportTable(List.of("Sujet", "Action", "Enjeu"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.END),
                        List.of(List.of("Remplissage", "Vendre 236 nuits de plus", "32 000,00 EUR")),
                        List.of()),
                null, List.of(ReportNote.warning("Occupation sous la cible", "23,9 %")), null, null));

        sections.add(new ReportSection("glossary", "Definitions", "Les indicateurs",
                ReportSectionKind.GLOSSARY,
                new ReportTable(List.of("Terme", "Definition"),
                        List.of(ReportAlign.START, ReportAlign.START),
                        List.of(List.of("Revenus bruts", "Total des loyers percus.")),
                        List.of()),
                null, List.of(), null, null));

        return new ReportSnapshot(base.meta(), base.kpis(), sections);
    }

    /**
     * Chaque page porte son numero.
     *
     * <p>Une page detachee d'un rapport de seize doit rester situable, et deux
     * versions doivent se distinguer. La couverture en est exempte : c'est la
     * page de titre.</p>
     */
    @Test
    void whenRenderingASnapshot_thenEveryPageButTheCoverIsNumbered() throws IOException {
        final byte[] pdf = pdfService.toPdf(fullSnapshot(), narrative(), false);

        try (PdfDocument document = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf)))) {
            final int total = document.getNumberOfPages();
            assertThat(total).isGreaterThan(1);

            assertThat(PdfTextExtractor.getTextFromPage(document.getPage(1)))
                    .as("la couverture ne porte pas de pied de page")
                    .doesNotContain("1 / " + total);

            for (int page = 2; page <= total; page++) {
                assertThat(PdfTextExtractor.getTextFromPage(document.getPage(page)))
                        .as("la page %d porte son numero", page)
                        .contains(page + " / " + total)
                        .contains("Conciergerie d'essai");
            }
        }
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    private ReportNarrative narrative() {
        return new ReportNarrative(
                "La periode progresse nettement sur un an.",
                java.util.Map.of("performance", "Le mois d'aout porte l'essentiel du volume."),
                List.of("L'occupation reste sous la cible."),
                "test-model", false, null);
    }

    private ReportSnapshot fullSnapshot() {
        return snapshotWith("Villa Cauderan");
    }

    /** Un snapshot portant les SIX formes de graphique et les principaux types de section. */
    private ReportSnapshot snapshotWith(String propertyName) {
        final ReportMeta meta = new ReportMeta(
                "R-2026-0001", 1, ReportProfile.OWNER, "Releve de gestion",
                "Conciergerie d'essai", null, "Jean Proprietaire",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31),
                LocalDate.of(2025, 8, 1), LocalDate.of(2025, 8, 31),
                Instant.parse("2026-09-04T20:00:00Z"), "EUR",
                List.of(propertyName, "Studio Jemmapes"), "Perimetre d'essai");

        final List<ReportKpi> kpis = List.of(
                new ReportKpi("revenue", "Revenus", "10 197,57 €", new BigDecimal("10197.57"),
                        new BigDecimal("12.4"), new BigDecimal("311.2"), true, null),
                new ReportKpi("occupancy", "Occupation", "23,9 %", new BigDecimal("23.9"),
                        new BigDecimal("-4.1"), new BigDecimal("267.7"), true, null));

        final List<String> months = List.of("juil. 26", "aout 26");
        final List<BigDecimal> a = List.of(new BigDecimal("4200"), new BigDecimal("10197"));
        final List<BigDecimal> b = List.of(new BigDecimal("3100"), new BigDecimal("2480"));

        final ReportTable table = new ReportTable(
                List.of("Mois", "Revenus"), ReportTable.numericAligns(2),
                List.of(List.of("juil. 26", "4 200,00 €"), List.of("aout 26", "10 197,57 €")),
                List.of("Total", "14 397,57 €"));

        final List<ReportNote> notes = List.of(
                // Un montant a separateur de milliers : c'est precisement celui
                // que la mise en page flottante coupait.
                ReportNote.positive("Meilleure contribution", "Villa").withImpact("9\u202F294,32 €"),
                ReportNote.warning("Occupation sous la cible", "23,9 % contre 60 %"));

        final List<ReportSection> sections = List.of(
                new ReportSection("performance", "Performance commerciale", "Mois par mois",
                        ReportSectionKind.CHART_TABLE, table,
                        new ReportChart(ReportChartType.BARS, months,
                                List.of(ReportSeries.of("a", "Cette periode", a),
                                        ReportSeries.of("b", "An dernier", b).withTone("neutral")),
                                "money"),
                        notes, null, null),
                new ReportSection("occupancy", "Occupation", "Nuits",
                        ReportSectionKind.CHART, null,
                        new ReportChart(ReportChartType.STACKED_BARS, months,
                                List.of(ReportSeries.of("sold", "Vendues", a).withTone("success"),
                                        ReportSeries.of("free", "Invendues", b).withTone("warning")),
                                "count"),
                        List.of(), null, null),
                new ReportSection("distribution", "Mix de distribution", "Par canal",
                        ReportSectionKind.CHART, null,
                        new ReportChart(ReportChartType.DONUT, List.of("Airbnb", "Direct", "Vrbo"),
                                List.of(ReportSeries.of("r", "Revenus", List.of(
                                        new BigDecimal("5300"), new BigDecimal("3300"),
                                        new BigDecimal("1597")))),
                                "money"),
                        List.of(), null, null),
                new ReportSection("properties", "Detail par bien", "Contribution",
                        ReportSectionKind.CHART, null,
                        new ReportChart(ReportChartType.HORIZONTAL_BARS,
                                List.of(propertyName, "Studio Jemmapes"),
                                List.of(ReportSeries.of("r", "Revenus", a)), "money"),
                        List.of(), null, null),
                new ReportSection("outlook", "Perspectives", "A venir",
                        ReportSectionKind.CHART, null,
                        new ReportChart(ReportChartType.LINES, months,
                                List.of(ReportSeries.of("otb", "Reserve", a),
                                        ReportSeries.of("stly", "An dernier", b).dashedLine()),
                                "count"),
                        List.of(), null, null),
                new ReportSection("trend", "Tendance", "Aires",
                        ReportSectionKind.CHART, null,
                        new ReportChart(ReportChartType.AREA, months,
                                List.of(ReportSeries.of("a", "Revenus", a)), "money"),
                        List.of(), null, null),
                new ReportSection("pnl", "Compte de resultat", "Cascade",
                        ReportSectionKind.PNL,
                        new ReportTable(List.of("Poste", "Montant", "Part"),
                                List.of(ReportAlign.START, ReportAlign.END, ReportAlign.END),
                                List.of(List.of("Revenus bruts", "10 197,57 €", "")),
                                List.of("Net proprietaire", "7 079,42 €", "69,4 %")),
                        null, List.of(), null, null),
                new ReportSection("notice", "Perimetre et methode", "Ce que couvre ce document",
                        ReportSectionKind.NOTICE, null, null, List.of(),
                        "Ce document couvre 2 biens.\n\nLes revenus sont attribues a la nuit.", null));

        return new ReportSnapshot(meta, kpis, sections);
    }
}
