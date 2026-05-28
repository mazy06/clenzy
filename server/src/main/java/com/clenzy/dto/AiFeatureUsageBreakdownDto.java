package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Breakdown detaille de la consommation tokens + cout USD par feature, avec
 * decomposition par (provider, model). Resout le bug d'agregation aveugle :
 * 100k tokens Sonnet et 100k Haiku n'etaient plus distinguables dans l'ancien
 * AiUsageStatsDto qui sommait tout dans un seul nombre par feature.
 *
 * <p>Exemple de payload :</p>
 * <pre>{@code
 * {
 *   "monthYear": "2026-05",
 *   "breakdownByFeature": {
 *     "ASSISTANT_CHAT": [
 *       { provider:"anthropic", model:"claude-sonnet-4", tokensIn:140000, tokensOut:18000, costUsd:0.69 },
 *       { provider:"anthropic", model:"claude-haiku-4-5", tokensIn:20000, tokensOut:3000, costUsd:0.028 }
 *     ],
 *     "DESIGN": [
 *       { provider:"nvidia",    model:"qwen3-coder-480b",  tokensIn:50000,  tokensOut:8000, costUsd:0.00 }
 *     ]
 *   }
 * }
 * }</pre>
 */
public record AiFeatureUsageBreakdownDto(
        String monthYear,
        Map<String, List<ModelUsage>> breakdownByFeature
) {

    /**
     * Detail d'usage pour une combinaison (provider, model) au sein d'une feature.
     *
     * @param provider   nom provider (ex: "anthropic", "openai", "nvidia")
     * @param model      identifiant modele (ex: "claude-sonnet-4-20250514")
     * @param tokensIn   somme prompt_tokens cumulee sur la periode
     * @param tokensOut  somme completion_tokens cumulee sur la periode
     * @param costUsd    cout en USD calcule via LlmPricingService
     * @param callCount  nombre d'appels LLM avec ce (provider, model)
     */
    public record ModelUsage(
            String provider,
            String model,
            long tokensIn,
            long tokensOut,
            BigDecimal costUsd,
            long callCount
    ) {}
}
