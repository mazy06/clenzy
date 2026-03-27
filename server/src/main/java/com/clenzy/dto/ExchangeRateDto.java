package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO pour les taux de change (lecture seule, reponses API).
 */
public record ExchangeRateDto(
    Long id,
    String baseCurrency,
    String targetCurrency,
    BigDecimal rate,
    LocalDate rateDate,
    String source
) {}
