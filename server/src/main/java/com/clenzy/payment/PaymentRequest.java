package com.clenzy.payment;

import java.math.BigDecimal;
import java.util.List;
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
    Map<String, String> metadata,
    /** Checkout embarqué (inline, {@code clientSecret}) plutôt qu'hébergé (redirection). */
    boolean embedded,
    /** Expiration de la session (epoch seconds) ; {@code null} = défaut provider. */
    Long expiresAtEpochSeconds,
    /** Enregistrer la carte pour un usage ultérieur off-session (caution) ; requiert la capacité CUSTOMER. */
    boolean saveCardForFutureUse,
    /** Codes pays ISO-2 pour la collecte d'adresse de livraison (biens physiques) ; vide = pas de collecte. */
    List<String> shippingAddressCountries
) {
    public PaymentRequest {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException("Currency is required");
        }
    }

    /** Constructeur rétro-compatible (checkout hébergé standard, sans options embedded). */
    public PaymentRequest(BigDecimal amount, String currency, String description, String customerEmail,
                          String customerName, String successUrl, String cancelUrl, String idempotencyKey,
                          Map<String, String> metadata) {
        this(amount, currency, description, customerEmail, customerName, successUrl, cancelUrl,
            idempotencyKey, metadata, false, null, false, null);
    }

    /** Constructeur avec options embedded, sans collecte d'adresse de livraison. */
    public PaymentRequest(BigDecimal amount, String currency, String description, String customerEmail,
                          String customerName, String successUrl, String cancelUrl, String idempotencyKey,
                          Map<String, String> metadata, boolean embedded, Long expiresAtEpochSeconds,
                          boolean saveCardForFutureUse) {
        this(amount, currency, description, customerEmail, customerName, successUrl, cancelUrl,
            idempotencyKey, metadata, embedded, expiresAtEpochSeconds, saveCardForFutureUse, null);
    }
}
