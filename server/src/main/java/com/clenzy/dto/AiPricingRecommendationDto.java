package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Recommandation de pricing generee par LLM.
 *
 * @param date              date de la recommandation
 * @param suggestedPrice    prix suggere
 * @param explanation       explication en langage naturel
 * @param confidence        niveau de confiance (0.0 - 1.0)
 * @param marketComparison  comparaison avec le marche local
 * @param factors           facteurs pris en compte
 */
public record AiPricingRecommendationDto(
        LocalDate date,
        BigDecimal suggestedPrice,
        String explanation,
        double confidence,
        String marketComparison,
        List<String> factors
) {
}
