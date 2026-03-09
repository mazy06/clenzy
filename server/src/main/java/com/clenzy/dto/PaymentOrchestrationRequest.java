package com.clenzy.dto;

import com.clenzy.model.PaymentProviderType;

import java.math.BigDecimal;
import java.util.Map;

public record PaymentOrchestrationRequest(
    BigDecimal amount,
    String currency,
    String sourceType,
    Long sourceId,
    String description,
    String customerEmail,
    PaymentProviderType preferredProvider,
    String successUrl,
    String cancelUrl,
    Map<String, String> metadata,
    String idempotencyKey
) {
    /**
     * Compact constructor without idempotency key for backward compatibility.
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, null);
    }
}
