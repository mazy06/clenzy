package com.clenzy.dto;

import java.util.List;

/**
 * Resultat d'analyse de sentiment via LLM.
 *
 * @param score              score de sentiment (-1.0 a 1.0)
 * @param label              label (POSITIVE, NEGATIVE, NEUTRAL, MIXED)
 * @param themes             themes detectes dans le texte
 * @param actionableInsights insights actionnables pour le property manager
 * @param suggestedResponse  draft de reponse suggeree au review
 */
public record AiSentimentResultDto(
        double score,
        String label,
        List<String> themes,
        List<String> actionableInsights,
        String suggestedResponse
) {
}
