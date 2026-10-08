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
    List<VatBreakdownDto> breakdown,
    List<IssuerSummary> issuers
) {
    public VatSummaryDto(String countryCode,String currency,String period,BigDecimal totalHt,BigDecimal totalTax,BigDecimal totalTtc,int invoiceCount,List<VatBreakdownDto> breakdown) {
        this(countryCode,currency,period,totalHt,totalTax,totalTtc,invoiceCount,breakdown,List.of());
    }

    /** Les déclarations se lisent par émetteur, pays et devise d'origine. */
    public record IssuerSummary(String issuerKey,String sellerName,VatSummaryDto summary) {}

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
