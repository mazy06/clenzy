package com.clenzy.dto;

import java.util.List;
import java.util.Map;

/**
 * Ligne de résultat du Report Builder : les valeurs de dimensions dans l'ordre
 * demandé, puis les métriques calculées (clé = code de métrique ; une métrique
 * sans dénominateur — ex. OCCUPANCY sans nuit disponible — est absente de la map).
 */
public record ReportResultRowDto(
        List<String> dimensionValues,
        Map<String, Object> metrics) {
}
