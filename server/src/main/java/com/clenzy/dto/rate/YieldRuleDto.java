package com.clenzy.dto.rate;

import java.math.BigDecimal;

/**
 * DTO pour les regles de yield management (CRUD).
 */
public record YieldRuleDto(
    Long id,
    Long propertyId,
    String name,
    String ruleType,
    String triggerCondition,
    String adjustmentType,
    BigDecimal adjustmentValue,
    BigDecimal minPrice,
    BigDecimal maxPrice,
    Boolean isActive,
    Integer priority
) {}
