package com.clenzy.dto;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO pour une facture complete avec ses lignes.
 */
public record InvoiceDto(
    Long id,
    Long organizationId,
    String invoiceNumber,
    LocalDate invoiceDate,
    LocalDate dueDate,
    String currency,
    String countryCode,
    BigDecimal totalHt,
    BigDecimal totalTax,
    BigDecimal totalTtc,
    String sellerName,
    String sellerAddress,
    String sellerTaxId,
    String buyerName,
    String buyerAddress,
    String buyerTaxId,
    Long reservationId,
    Long payoutId,
    InvoiceStatus status,
    String legalMentions,
    List<InvoiceLineDto> lines,
    LocalDateTime createdAt
) {
    public static InvoiceDto from(Invoice invoice) {
        List<InvoiceLineDto> lineDtos = invoice.getLines() != null
            ? invoice.getLines().stream().map(InvoiceLineDto::from).toList()
            : List.of();

        return new InvoiceDto(
            invoice.getId(),
            invoice.getOrganizationId(),
            invoice.getInvoiceNumber(),
            invoice.getInvoiceDate(),
            invoice.getDueDate(),
            invoice.getCurrency(),
            invoice.getCountryCode(),
            invoice.getTotalHt(),
            invoice.getTotalTax(),
            invoice.getTotalTtc(),
            invoice.getSellerName(),
            invoice.getSellerAddress(),
            invoice.getSellerTaxId(),
            invoice.getBuyerName(),
            invoice.getBuyerAddress(),
            invoice.getBuyerTaxId(),
            invoice.getReservationId(),
            invoice.getPayoutId(),
            invoice.getStatus(),
            invoice.getLegalMentions(),
            lineDtos,
            invoice.getCreatedAt()
        );
    }
}
