package com.clenzy.dto.rate;

import java.math.BigDecimal;

/**
 * DTO pour les remises basees sur la duree de sejour (CRUD).
 */
public record LengthOfStayDiscountDto(
    Long id,
    Long propertyId,
    int minNights,
    Integer maxNights,
    String discountType,
    BigDecimal discountValue,
    Boolean isActive,
    String startDate,
    String endDate
) {}
