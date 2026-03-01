package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExternalPriceRecommendation(
    Long propertyId,
    LocalDate date,
    BigDecimal recommendedPrice,
    String currency,
    Double confidence,
    String source
) {}
