package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.Map;
import java.util.TreeMap;

/**
 * DTO pour le resume agrege des paiements.
 */
public class PaymentSummaryDto {
    public BigDecimal totalPaid = BigDecimal.ZERO;
    public BigDecimal totalPaidByOta = BigDecimal.ZERO;
    public BigDecimal totalToVerify = BigDecimal.ZERO;
    public Map<String, BigDecimal> paidByOtaByCurrency = new TreeMap<>();
    public Map<String, BigDecimal> toVerifyByCurrency = new TreeMap<>();
    public BigDecimal totalPending = BigDecimal.ZERO;
    public BigDecimal totalRefunded = BigDecimal.ZERO;
    public int transactionCount = 0;
}
