package com.clenzy.dto.yield;

import com.clenzy.model.YieldAdjustment;

import java.math.BigDecimal;

/**
 * Ligne du journal des ajustements yield v1 (lecture seule, écran Tarification).
 */
public record YieldAdjustmentDto(
    Long id,
    Long propertyId,
    Long ruleId,
    String targetDate,
    String adjustmentDay,
    String mode,
    BigDecimal priceBefore,
    BigDecimal priceAfter,
    BigDecimal occupancyPct,
    BigDecimal thresholdPct,
    String comparison,
    String reason,
    Long suggestionId,
    String skipReason,
    String createdAt
) {

    public static YieldAdjustmentDto from(YieldAdjustment entity) {
        return new YieldAdjustmentDto(
                entity.getId(),
                entity.getPropertyId(),
                entity.getRuleId(),
                entity.getTargetDate() != null ? entity.getTargetDate().toString() : null,
                entity.getAdjustmentDay() != null ? entity.getAdjustmentDay().toString() : null,
                entity.getMode() != null ? entity.getMode().name() : null,
                entity.getPriceBefore(),
                entity.getPriceAfter(),
                entity.getOccupancyPct(),
                entity.getThresholdPct(),
                entity.getComparison(),
                entity.getReason(),
                entity.getSuggestionId(),
                entity.getSkipReason(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null
        );
    }
}
