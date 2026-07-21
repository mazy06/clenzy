package com.clenzy.dto;

import java.util.List;

/**
 * Agrégats de l'onglet Interventions de l'écran Rapports Baitly.
 *
 * <p>Remplace côté client le téléchargement d'une liste {@code size=1000}
 * (résultats faux au-delà de 1000 interventions) par des requêtes
 * {@code GROUP BY} bornées (audit perf 2026-07-21). {@code byType} est
 * ventilé par type BRUT : le regroupement en catégories affichées
 * (Nettoyage / Maintenance / …) reste côté client (libellés localisés).</p>
 */
public record ReportInterventionStatsDto(
        List<ReportChartItemDto> byStatus,
        List<ReportChartItemDto> byType,
        List<MonthlyCountDto> byMonth,
        List<ReportChartItemDto> byPriority) {

    /**
     * Compteurs d'un mois — {@code month} au format ISO {@code yyyy-MM}
     * (le libellé localisé est produit côté client).
     */
    public record MonthlyCountDto(String month, long total, long completed, long pending) {}
}
