package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Snapshot de consommation de l'assistant conversationnel (chat + briefings)
 * pour une organisation, sur une periode donnee.
 *
 * <p>Format optimise pour l'affichage du badge frontend "$0.12 ce mois ·
 * 1.2k tokens" + tooltip detaille (breakdown par modele).</p>
 *
 * @param tokensIn       total tokens prompt cumules sur la periode
 * @param tokensOut      total tokens completion cumules sur la periode
 * @param costUsd        cout cumule en USD (calcule via {@code LlmPricingService})
 * @param byModel        breakdown par modele (Sonnet/Haiku/Opus/GPT...)
 * @param period         label de la periode ("today" / "month" / "all")
 * @param monthlyBudget  budget mensuel configure (tokens) — null si BYOK ou non defini
 * @param requestCount   nombre d'appels LLM cumules (utile pour cost-per-request avg)
 */
public record AssistantUsageDto(
        long tokensIn,
        long tokensOut,
        BigDecimal costUsd,
        List<ModelBreakdown> byModel,
        String period,
        Long monthlyBudget,
        long requestCount
) {
    /**
     * Detail par modele invoque sur la periode.
     *
     * @param model     nom du modele (ex: "claude-sonnet-4-20250514")
     * @param tokensIn  tokens prompt pour ce modele
     * @param tokensOut tokens completion pour ce modele
     * @param costUsd   cout USD pour ce modele
     * @param count     nombre d'appels avec ce modele
     */
    public record ModelBreakdown(
            String model,
            long tokensIn,
            long tokensOut,
            BigDecimal costUsd,
            long count
    ) {}
}
