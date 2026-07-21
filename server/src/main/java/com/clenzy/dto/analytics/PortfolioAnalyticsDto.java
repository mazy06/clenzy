package com.clenzy.dto.analytics;

import java.util.List;

/**
 * Analytics agrégées d'un portefeuille (org), calculées CÔTÉ SERVEUR — rapatriement
 * des slices porteuses de corrections de formule de {@code analyticsComputeFunctions.ts}
 * (global / revenue / occupancy). Mêmes shapes que les types TS {@code GlobalKPIs} /
 * {@code RevenueMetrics} / {@code OccupancyMetrics} pour un recâblage sans adaptateur.
 *
 * <p>Corrections vs calcul client : coûts d'intervention RÉELS (le client passait
 * {@code interventions=[]} → marge et ROI faussés), et données jamais tronquées par
 * une pagination front. La fenêtre glissante et la comparaison période N-1 (glissante,
 * pas year-over-year) reproduisent fidèlement {@code computeGlobalKPIs}.</p>
 */
public record PortfolioAnalyticsDto(
        GlobalKpis global,
        RevenueMetrics revenue,
        OccupancyMetrics occupancy) {

    /** Valeur avec sa période précédente et le taux de croissance en % (arrondi entier). */
    public record TrendValue(double value, double previous, int growth) {
    }

    public record GlobalKpis(
            TrendValue revPAN,
            TrendValue adr,
            TrendValue occupancyRate,
            TrendValue totalRevenue,
            TrendValue netMargin,
            TrendValue roi,
            TrendValue avgStayDuration,
            long activeProperties,
            long pendingRequests,
            long activeInterventions) {
    }

    public record MonthlyRevenue(String month, long revenue, long expenses, long profit) {
    }

    public record ChannelRevenue(String name, long value, String color) {
    }

    public record PropertyRevenue(long propertyId, String name, long revenue) {
    }

    public record RevenueMetrics(
            List<MonthlyRevenue> byMonth,
            List<ChannelRevenue> byChannel,
            List<PropertyRevenue> byProperty,
            int revenueGrowth,
            long avgRevenuePerBooking) {
    }

    public record MonthlyOccupancy(String month, long occupied, long vacant, double rate) {
    }

    public record PropertyOccupancy(
            long propertyId, String name, double rate, long occupiedNights, long totalNights) {
    }

    public record DayOccupancy(String date, double rate) {
    }

    public record OccupancyMetrics(
            double globalRate,
            List<PropertyOccupancy> byProperty,
            List<MonthlyOccupancy> byMonth,
            long gapNights,
            List<DayOccupancy> heatmap) {
    }
}
