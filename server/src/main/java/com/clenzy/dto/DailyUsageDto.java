package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Une ligne de la série temporelle de consommation IA : agrégat par (jour, provider, model).
 * Alimente la vue « Consommation » (courbe dans le temps + coût par modèle).
 */
public record DailyUsageDto(
        String date,       // ISO yyyy-MM-dd
        String provider,   // openai / anthropic / nvidia …
        String model,
        long tokensIn,
        long tokensOut,
        long calls,
        BigDecimal costUsd
) {}
