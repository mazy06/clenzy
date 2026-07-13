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
    String idempotencyKey,
    /** Checkout embarqué (inline, {@code clientSecret}) plutôt qu'hébergé (redirection). */
    boolean embedded,
    /** Expiration de la session (epoch seconds) ; {@code null} = défaut provider. */
    Long expiresAtEpochSeconds,
    /** Enregistrer la carte pour un usage ultérieur off-session (caution). */
    boolean saveCardForFutureUse
) {
    /**
     * Compact constructor without idempotency key for backward compatibility.
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, null, false, null, false);
    }

    /**
     * Constructeur checkout hébergé standard (avec clé d'idempotence, sans options embedded).
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata, String idempotencyKey) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, idempotencyKey, false, null, false);
    }
}
