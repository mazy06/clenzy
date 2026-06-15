package com.clenzy.dto;

/**
 * Analyse du dernier message voyageur d'une conversation (CLZ Domaine 6) : sentiment + urgence.
 *
 * @param sentiment libellé de sentiment (POSITIVE / NEUTRAL / NEGATIVE)
 * @param score     score de sentiment (négatif = mécontent, positif = satisfait)
 * @param urgent    true si le message paraît urgent
 */
public record ConversationAnalysisDto(String sentiment, double score, boolean urgent) {
}
