package com.clenzy.dto;

import java.util.List;

/**
 * Agrégats de l'onglet Finances de l'écran Rapports Baitly.
 *
 * <p>{@code monthlyFinancials} : dépenses = coûts d'interventions du mois ;
 * revenus = estimation grossière (dépenses × 1,3) héritée de l'ancien calcul
 * client — à remplacer par la facturation réelle quand elle sera branchée.
 * {@code costBreakdown} est ventilé par type BRUT d'intervention (le
 * regroupement en catégories affichées reste côté client).</p>
 */
public record ReportFinancialStatsDto(
        List<MonthlyFinancialDto> monthlyFinancials,
        List<ReportChartItemDto> costBreakdown) {

    /** Montants arrondis en euros — {@code month} au format ISO {@code yyyy-MM}. */
    public record MonthlyFinancialDto(String month, long revenue, long expenses, long profit) {}
}
