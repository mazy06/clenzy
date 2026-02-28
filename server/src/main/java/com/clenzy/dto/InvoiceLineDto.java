package com.clenzy.dto;

import com.clenzy.model.InvoiceLine;

import java.math.BigDecimal;

/**
 * DTO pour une ligne de facture.
 */
public record InvoiceLineDto(
    Long id,
    Integer lineNumber,
    String description,
    BigDecimal quantity,
    BigDecimal unitPriceHt,
    String taxCategory,
    BigDecimal taxRate,
    BigDecimal taxAmount,
    BigDecimal totalHt,
    BigDecimal totalTtc
) {
    public static InvoiceLineDto from(InvoiceLine line) {
        return new InvoiceLineDto(
            line.getId(),
            line.getLineNumber(),
            line.getDescription(),
            line.getQuantity(),
            line.getUnitPriceHt(),
            line.getTaxCategory(),
            line.getTaxRate(),
            line.getTaxAmount(),
            line.getTotalHt(),
            line.getTotalTtc()
        );
    }
}
