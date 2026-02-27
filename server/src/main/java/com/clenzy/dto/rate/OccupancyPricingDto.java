package com.clenzy.dto.rate;

import java.math.BigDecimal;

/**
 * DTO pour la tarification basee sur l'occupation (CRUD).
 */
public record OccupancyPricingDto(
    Long id,
    Long propertyId,
    int baseOccupancy,
    BigDecimal extraGuestFee,
    int maxOccupancy,
    BigDecimal childDiscount,
    Boolean isActive
) {}
