package com.clenzy.dto;

import java.math.BigDecimal;

public record OwnerPropertySummaryDto(
    Long propertyId,
    String propertyName,
    int totalReservations,
    BigDecimal revenue,
    BigDecimal commission,
    BigDecimal netRevenue,
    double occupancyRate,
    Double averageRating
) {}
