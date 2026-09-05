package com.clenzy.dto.report;

import java.math.BigDecimal;
import java.util.List;

/**
 * Une serie d'un graphique.
 *
 * @param values valeurs alignees sur les categories du graphique ; {@code null}
 *               pour un point absent — une projection n'a pas de realise, et
 *               relier les deux par un trait plein mentirait
 * @param tone   teinte semantique ({@code success}, {@code warning}, ...) ou
 *               {@code null} pour prendre le jeton de serie suivant
 * @param dashed trait discontinu — une projection, une reference, un N-1
 */
public record ReportSeries(
        String key,
        String label,
        List<BigDecimal> values,
        String tone,
        boolean dashed
) {
    public ReportSeries {
        values = values == null ? List.of() : java.util.Collections.unmodifiableList(new java.util.ArrayList<>(values));
    }

    public static ReportSeries of(String key, String label, List<BigDecimal> values) {
        return new ReportSeries(key, label, values, null, false);
    }

    public ReportSeries withTone(String newTone) {
        return new ReportSeries(key, label, values, newTone, dashed);
    }

    public ReportSeries dashedLine() {
        return new ReportSeries(key, label, values, tone, true);
    }
}
