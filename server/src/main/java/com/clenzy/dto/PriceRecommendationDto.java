package com.clenzy.dto;

import com.clenzy.model.PriceRecommendation;
import com.clenzy.model.PriceRecommendationSource;
import com.clenzy.model.PriceRecommendationStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Vue d'une recommandation de prix (CLZ-P0-17). DTO record, jamais l'entité JPA exposée (audit #5).
 *
 * @param delta {@code suggestedPrice - basePrice} (positif = hausse suggérée), null si pas de base.
 */
public record PriceRecommendationDto(
    Long id,
    Long propertyId,
    LocalDate date,
    BigDecimal suggestedPrice,
    BigDecimal basePrice,
    BigDecimal delta,
    String currency,
    PriceRecommendationSource source,
    PriceRecommendationStatus status,
    String reason
) {
    public static PriceRecommendationDto from(PriceRecommendation r) {
        BigDecimal delta = (r.getSuggestedPrice() != null && r.getBasePrice() != null)
            ? r.getSuggestedPrice().subtract(r.getBasePrice())
            : null;
        return new PriceRecommendationDto(
            r.getId(), r.getPropertyId(), r.getRecoDate(),
            r.getSuggestedPrice(), r.getBasePrice(), delta,
            r.getCurrency(), r.getSource(), r.getStatus(), r.getReason());
    }
}
