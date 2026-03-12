package com.clenzy.dto;

/**
 * Insight analytique genere par LLM.
 *
 * @param type           type d'insight (ANOMALY, TREND, RECOMMENDATION, WARNING)
 * @param severity       severite (LOW, MEDIUM, HIGH, CRITICAL)
 * @param title          titre court de l'insight
 * @param description    description detaillee
 * @param recommendation recommandation actionnable
 */
public record AiInsightDto(
        String type,
        String severity,
        String title,
        String description,
        String recommendation
) {
}
