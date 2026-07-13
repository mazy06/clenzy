package com.clenzy.payment;

public record PaymentResult(
    boolean success,
    String providerTxId,
    String redirectUrl,
    String clientSecret,
    String status,
    String errorMessage
) {
    public static PaymentResult success(String providerTxId, String redirectUrl) {
        return new PaymentResult(true, providerTxId, redirectUrl, null, "CREATED", null);
    }

    public static PaymentResult success(String providerTxId, String redirectUrl, String status) {
        return new PaymentResult(true, providerTxId, redirectUrl, null, status, null);
    }

    /**
     * Résultat d'un checkout <strong>embarqué</strong> (inline) : pas de redirection,
     * le client finalise le paiement via un {@code clientSecret}.
     */
    public static PaymentResult embedded(String providerTxId, String clientSecret) {
        return new PaymentResult(true, providerTxId, null, clientSecret, "CREATED", null);
    }

    public static PaymentResult failure(String errorMessage) {
        return new PaymentResult(false, null, null, null, "FAILED", errorMessage);
    }
}
