package com.clenzy.dto;

import java.util.List;

/**
 * Agrégats de l'onglet Équipes de l'écran Rapports Baitly : compteurs
 * d'interventions assignées à chaque équipe, par état d'avancement.
 */
public record ReportTeamStatsDto(List<TeamPerformanceDto> teamPerformance) {

    public record TeamPerformanceDto(String name, long completed, long inProgress, long pending) {}
}
