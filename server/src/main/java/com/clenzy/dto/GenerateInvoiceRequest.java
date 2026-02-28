package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Requete pour generer une facture a partir d'une reservation.
 */
public record GenerateInvoiceRequest(
    Long reservationId,
    String buyerName,
    String buyerAddress,
    String buyerTaxId,
    BigDecimal touristTaxRatePerPerson
) {}
