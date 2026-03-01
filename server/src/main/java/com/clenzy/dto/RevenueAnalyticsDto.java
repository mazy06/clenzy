package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Analytics de revenu et occupation pour une propriete sur une periode.
 */
public record RevenueAnalyticsDto(
    Long propertyId,
    LocalDate from,
    LocalDate to,
    int totalNights,
    int bookedNights,
    double occupancyRate,          // 0.0 to 1.0
    BigDecimal totalRevenue,
    BigDecimal averageDailyRate,   // ADR = revenue / booked nights
    BigDecimal revPar,             // RevPAR = revenue / total nights
    Map<String, Double> occupancyByMonth,
    Map<String, BigDecimal> revenueByMonth,
    Map<String, Integer> bookingsBySource,
    List<OccupancyForecastDto> forecast
) {}
