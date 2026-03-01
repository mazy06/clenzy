package com.clenzy.dto.rate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Requete de mise a jour tarifaire en masse.
 */
public record BulkRateUpdateRequest(
    List<Long> propertyIds,
    LocalDate from,
    LocalDate to,
    String priceAdjustmentType,
    BigDecimal priceAdjustmentValue
) {}
