package com.clenzy.dto.report;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.List;

/**
 * Graphique d'une section, decrit sans supposer qui le dessine.
 *
 * @param categories libelles de l'axe des categories
 * @param series     series alignees sur ces categories
 * @param valueUnit  {@code money}, {@code percent}, {@code count} — pilote le
 *                   formatage des graduations dans les trois rendus
 */
public record ReportChart(
        ReportChartType type,
        List<String> categories,
        List<ReportSeries> series,
        String valueUnit
) {
    public ReportChart {
        categories = categories == null ? List.of() : List.copyOf(categories);
        series = series == null ? List.of() : List.copyOf(series);
    }

    /**
     * Vrai si rien n'est a tracer.
     *
     * <p>{@code @JsonIgnore} : sans lui, Jackson prend cet accesseur pour une
     * propriete {@code empty} et l'ECRIT dans le snapshot persiste. Le champ
     * derive s'y trouvait donc a cote des donnees dont il decoule, et tout
     * lecteur strict echouait a relire le document. L'application ne le voyait
     * pas — la configuration Spring ignore les champs inconnus — mais un
     * export, un outil d'analyse ou un test l'auraient rencontre.</p>
     */
    @JsonIgnore
    public boolean isEmpty() {
        return series.isEmpty() || series.stream().allMatch(s -> s.values().isEmpty());
    }
}
