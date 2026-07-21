package com.clenzy.dto;

import java.util.List;

/**
 * Agrégats de l'onglet Logements de l'écran Rapports Baitly : top logements
 * par volume d'interventions, avec coût cumulé arrondi en euros.
 */
public record ReportPropertyStatsDto(List<PropertyStatDto> propertyStats) {

    public record PropertyStatDto(String name, long interventions, long cost) {}
}
