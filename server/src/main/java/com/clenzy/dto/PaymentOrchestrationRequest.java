package com.clenzy.dto;

import com.clenzy.model.PaymentProviderType;

import java.math.BigDecimal;
import java.util.List;
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
    boolean saveCardForFutureUse,
    /** Codes pays ISO-2 pour la collecte d'adresse de livraison (biens physiques) ; vide = pas de collecte. */
    List<String> shippingAddressCountries
) {
    /**
     * Compact constructor without idempotency key for backward compatibility.
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, null, false, null, false, null);
    }

    /**
     * Constructeur checkout hébergé standard (avec clé d'idempotence, sans options embedded).
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata, String idempotencyKey) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, idempotencyKey, false, null, false, null);
    }

    /**
     * Constructeur avec options embedded/expiry/saveCard, sans collecte d'adresse de livraison.
     */
    public PaymentOrchestrationRequest(BigDecimal amount, String currency, String sourceType,
                                        Long sourceId, String description, String customerEmail,
                                        PaymentProviderType preferredProvider, String successUrl,
                                        String cancelUrl, Map<String, String> metadata, String idempotencyKey,
                                        boolean embedded, Long expiresAtEpochSeconds, boolean saveCardForFutureUse) {
        this(amount, currency, sourceType, sourceId, description, customerEmail,
            preferredProvider, successUrl, cancelUrl, metadata, idempotencyKey,
            embedded, expiresAtEpochSeconds, saveCardForFutureUse, null);
    }
}
