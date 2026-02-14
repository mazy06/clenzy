package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * DTO pour le resume agrege des paiements.
 */
public class PaymentSummaryDto {
    public BigDecimal totalPaid = BigDecimal.ZERO;
    public BigDecimal totalPending = BigDecimal.ZERO;
    public BigDecimal totalRefunded = BigDecimal.ZERO;
    public int transactionCount = 0;
}
