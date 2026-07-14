package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Synthèse agrégée de l'écran Dashboard « Vue d'ensemble ».
 *
 * <p>Remplace côté client l'agrégation en mémoire de 5 listes {@code size=1000}
 * + toutes les réservations (audit perf navigation 2026-07) : le serveur ne
 * renvoie QUE les compteurs/KPI réellement affichés par l'overview.</p>
 *
 * <p>Formules « corrigées » (décision produit 2026-07-11) : revenus proratisés
 * aux nuits comprises dans la fenêtre, occupation plafonnée à 100 % — comme
 * {@code PropertyPerformanceService}, contrairement à l'ancien calcul frontend.</p>
 */
public record DashboardOverviewSummaryDto(
        KpiTrendDto occupancyRate,
        KpiTrendDto totalRevenue,
        KpiTrendDto adr,
        KpiTrendDto revPan,
        PropertiesStatDto properties,
        ServiceRequestsStatDto serviceRequests,
        InterventionsStatDto interventions,
        long urgentInterventionsCount,
        long pendingPaymentsCount) {

    /** Valeur d'un KPI + variation (%) vs la fenêtre précédente de même durée. */
    public record KpiTrendDto(double value, double growth) {}

    public record PropertiesStatDto(long active, long total, double growth) {}

    /** Compteurs sur la fenêtre de la période (créées dans la fenêtre). */
    public record ServiceRequestsStatDto(long pending, long total) {}

    /**
     * Compteurs interventions : {@code total/completed/completionRate/totalRevenue}
     * sur la fenêtre passée, {@code today} = planifiées aujourd'hui,
     * {@code upcoming} = planifiées dans les 7 prochains jours (non terminées).
     */
    public record InterventionsStatDto(long today, long total, double growth, long upcoming,
                                       long completed, double completionRate, BigDecimal totalRevenue) {}
}
