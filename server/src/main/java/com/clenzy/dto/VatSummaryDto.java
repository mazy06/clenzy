package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resume TVA pour le reporting fiscal.
 * Ventilation par taux de TVA avec totaux HT/TVA/TTC.
 */
public record VatSummaryDto(
    String countryCode,
    String currency,
    String period,
    BigDecimal totalHt,
    BigDecimal totalTax,
    BigDecimal totalTtc,
    int invoiceCount,
    List<VatBreakdownDto> breakdown
) {

    /**
     * Ventilation par taux de TVA.
     */
    public record VatBreakdownDto(
        String taxCategory,
        String taxName,
        BigDecimal taxRate,
        BigDecimal baseAmount,
        BigDecimal taxAmount,
        int lineCount
    ) {}
}
