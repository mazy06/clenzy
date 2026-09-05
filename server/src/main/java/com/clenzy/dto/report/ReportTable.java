package com.clenzy.dto.report;

import java.util.List;

/**
 * Tableau d'une section.
 *
 * <p>Les cellules sont des CHAINES deja formatees : c'est la seule facon que
 * l'ecran et le PDF affichent rigoureusement la meme chose. Les valeurs brutes
 * necessaires a l'agent voyagent dans les KPI et les series, pas ici.</p>
 *
 * @param columns  intitules de colonnes
 * @param aligns   alignement par colonne ; {@code null} = tout a gauche sauf la premiere
 * @param rows     lignes de cellules
 * @param totals   ligne de totaux, mise en evidence par les rendus ; peut etre vide
 */
public record ReportTable(
        List<String> columns,
        List<ReportAlign> aligns,
        List<List<String>> rows,
        List<String> totals
) {
    public ReportTable {
        columns = columns == null ? List.of() : List.copyOf(columns);
        aligns = aligns == null ? List.of() : List.copyOf(aligns);
        rows = rows == null ? List.of() : rows.stream().map(List::copyOf).toList();
        totals = totals == null ? List.of() : List.copyOf(totals);
    }

    /** Alignement par defaut : libelle a gauche, chiffres a droite. */
    public static List<ReportAlign> numericAligns(int columnCount) {
        return java.util.stream.IntStream.range(0, columnCount)
                .mapToObj(i -> i == 0 ? ReportAlign.START : ReportAlign.END)
                .toList();
    }
}
