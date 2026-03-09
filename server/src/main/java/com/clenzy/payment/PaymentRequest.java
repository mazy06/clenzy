package com.clenzy.payment;

import java.math.BigDecimal;
import java.util.Map;

public record PaymentRequest(
    BigDecimal amount,
    String currency,
    String description,
    String customerEmail,
    String customerName,
    String successUrl,
    String cancelUrl,
    String idempotencyKey,
    Map<String, String> metadata
) {
    public PaymentRequest {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException("Currency is required");
        }
    }
}
