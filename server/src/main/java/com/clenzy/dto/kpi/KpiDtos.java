package com.clenzy.dto.kpi;

import java.util.List;

/**
 * DTOs pour le dashboard KPI Readiness (Niveau 14 certification).
 * Records compacts — aucune logique metier.
 */
public final class KpiDtos {

    private KpiDtos() {}

    // ── KPI Item ─────────────────────────────────────────────────────────────

    /** Mesure individuelle d'un KPI */
    public record KpiItemDto(
            String id,           // ex: "UPTIME", "CALENDAR_LATENCY_P95"
            String name,         // ex: "Uptime", "Calendar Propagation Latency"
            String value,        // formatted, ex: "99.95%", "25.4ms"
            double rawValue,     // numeric pour comparaison
            String target,       // ex: ">= 99.9%", "< 30s P95"
            double targetValue,  // numeric pour comparaison
            String unit,         // ex: "%", "ms", "count"
            String status,       // OK, WARNING, CRITICAL
            boolean critical,    // true pour Uptime + Double Bookings
            int weight           // poids dans le score
    ) {}

    // ── Snapshot ─────────────────────────────────────────────────────────────

    /** Reponse snapshot KPI complet */
    public record KpiSnapshotDto(
            Long id,
            String capturedAt,
            double readinessScore,
            boolean criticalFailed,
            List<KpiItemDto> kpis,
            String source
    ) {}

    // ── History ──────────────────────────────────────────────────────────────

    /** Point de donnee historique pour le graphe tendance */
    public record KpiHistoryPointDto(
            String capturedAt,
            double readinessScore,
            double uptimePct,
            double syncErrorRatePct,
            double apiLatencyP95Ms,
            double calendarLatencyP95Ms,
            double inventoryCoherencePct,
            int doubleBookings,
            double syncAvailabilityPct,
            double outboxDrainTimeMs,
            double reconciliationDivergencePct
    ) {}

    /** Reponse historique avec metadata */
    public record KpiHistoryDto(
            List<KpiHistoryPointDto> points,
            int totalPoints,
            String from,
            String to
    ) {}
}
