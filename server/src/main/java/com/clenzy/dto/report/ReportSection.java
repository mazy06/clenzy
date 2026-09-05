package com.clenzy.dto.report;

import java.util.List;

/**
 * Une section du rapport.
 *
 * <p>Le champ {@code narrative} est le SEUL que l'agent remplit. Tout le reste
 * est calcule et fige avant qu'il n'intervienne : il commente des chiffres, il
 * n'en produit jamais.</p>
 *
 * @param notes     constats DETERMINISTES calcules par le moteur (« 3 biens sous
 *                  la cible »). Ils existent avec ou sans agent — un rapport sans
 *                  IA doit rester lisible.
 * @param narrative commentaire redige par l'agent, ou {@code null}
 */
public record ReportSection(
        String id,
        String title,
        String subtitle,
        ReportSectionKind kind,
        ReportTable table,
        ReportChart chart,
        List<ReportNote> notes,
        String body,
        String narrative
) {
    public ReportSection {
        notes = notes == null ? List.of() : List.copyOf(notes);
    }

    public ReportSection withNarrative(String text) {
        return new ReportSection(id, title, subtitle, kind, table, chart, notes, body, text);
    }

    public boolean hasChart() {
        return chart != null && !chart.isEmpty();
    }

    public boolean hasTable() {
        return table != null && !table.rows().isEmpty();
    }
}
