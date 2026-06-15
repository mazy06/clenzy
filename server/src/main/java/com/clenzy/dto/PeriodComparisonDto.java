package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Comparaison période courante vs période précédente (N vs N-1), calculée serveur (CLZ-P0-13).
 *
 * Source unique opposable du delta (le front ne recalcule plus). {@code basis} indique la
 * base comparative ({@code YEAR_OVER_YEAR} = même période N-1, ou {@code PREVIOUS_PERIOD}
 * = période glissante précédente).
 */
public record PeriodComparisonDto(
    LocalDate previousFrom,
    LocalDate previousTo,
    String basis,
    MetricComparison revenue,
    MetricComparison averageDailyRate,
    MetricComparison revPar,
    MetricComparison occupancy
) {
    /**
     * Comparaison d'une métrique : valeur courante, valeur précédente, variation en %.
     */
    public record MetricComparison(BigDecimal current, BigDecimal previous, BigDecimal growthPct) {}
}
