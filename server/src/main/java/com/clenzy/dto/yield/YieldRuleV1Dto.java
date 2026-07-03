package com.clenzy.dto.yield;

import java.math.BigDecimal;

/**
 * Règle de yield v1 (F8a) : « si occupation BELOW/ABOVE seuil sur la fenêtre
 * J → J+windowDaysAhead → ajuster de adjustmentPct % (ampleur positive, sens
 * déduit de la comparaison), cap maxDailyChangePct %/jour ».
 */
public record YieldRuleV1Dto(
    Long id,
    Long propertyId,
    String name,
    String comparison,
    BigDecimal occupancyThresholdPct,
    Integer windowDaysAhead,
    BigDecimal adjustmentPct,
    BigDecimal maxDailyChangePct,
    Boolean active,
    Integer priority
) {}
