package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PricePredictionDto(
    Long propertyId,
    LocalDate date,
    BigDecimal currentPrice,
    BigDecimal suggestedPrice,
    BigDecimal minPrice,
    BigDecimal maxPrice,
    double confidence,
    double predictedOccupancy,
    double demandScore,
    String reason
) {}
