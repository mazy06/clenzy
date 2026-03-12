package com.clenzy.dto;

import java.util.Map;

/**
 * Statistiques d'utilisation AI pour le dashboard.
 *
 * @param usageByFeature   tokens consommes par feature (ex: {"PRICING": 12000, "MESSAGING": 8500})
 * @param budgetByFeature  limite mensuelle par feature (ex: {"PRICING": 100000, "MESSAGING": 100000})
 * @param totalUsed        total tokens utilises ce mois
 * @param totalBudget      total budget disponible
 * @param monthYear        mois courant (format YYYY-MM)
 */
public record AiUsageStatsDto(
        Map<String, Long> usageByFeature,
        Map<String, Long> budgetByFeature,
        long totalUsed,
        long totalBudget,
        String monthYear
) {
}
