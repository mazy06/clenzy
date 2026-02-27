package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record OwnerDashboardDto(
    Long ownerId,
    int totalProperties,
    int activeReservations,
    BigDecimal totalRevenue,
    BigDecimal totalCommissions,
    BigDecimal netRevenue,
    double averageOccupancy,
    double averageRating,
    Map<String, BigDecimal> revenueByMonth,
    List<OwnerPropertySummaryDto> properties
) {}
