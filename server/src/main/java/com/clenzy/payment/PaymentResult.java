package com.clenzy.payment;

public record PaymentResult(
    boolean success,
    String providerTxId,
    String redirectUrl,
    String status,
    String errorMessage
) {
    public static PaymentResult success(String providerTxId, String redirectUrl) {
        return new PaymentResult(true, providerTxId, redirectUrl, "CREATED", null);
    }

    public static PaymentResult success(String providerTxId, String redirectUrl, String status) {
        return new PaymentResult(true, providerTxId, redirectUrl, status, null);
    }

    public static PaymentResult failure(String errorMessage) {
        return new PaymentResult(false, null, null, "FAILED", errorMessage);
    }
}
