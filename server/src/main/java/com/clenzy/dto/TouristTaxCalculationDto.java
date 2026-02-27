package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;

public record TouristTaxCalculationDto(
    Long propertyId,
    String communeName,
    TaxCalculationMode calculationMode,
    int nights,
    int guests,
    BigDecimal taxPerNight,
    BigDecimal totalTax,
    String details
) {}
