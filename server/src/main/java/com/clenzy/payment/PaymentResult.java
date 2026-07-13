package com.clenzy.payment;

public record PaymentResult(
    boolean success,
    String providerTxId,
    String redirectUrl,
    String clientSecret,
    /** Comment le front doit présenter ce checkout (auto-descriptif, provider-agnostique). */
    PaymentPresentationMode presentationMode,
    String status,
    String errorMessage
) {
    /** Checkout hébergé : redirection pleine page vers {@code redirectUrl}. */
    public static PaymentResult success(String providerTxId, String redirectUrl) {
        return new PaymentResult(true, providerTxId, redirectUrl, null,
            PaymentPresentationMode.REDIRECT, "CREATED", null);
    }

    public static PaymentResult success(String providerTxId, String redirectUrl, String status) {
        return new PaymentResult(true, providerTxId, redirectUrl, null,
            PaymentPresentationMode.REDIRECT, status, null);
    }

    /**
     * Checkout <strong>embarqué</strong> par {@code clientSecret} (Stripe Embedded
     * Checkout) : le front monte le composant du provider inline, pas de redirection.
     */
    public static PaymentResult embedded(String providerTxId, String clientSecret) {
        return new PaymentResult(true, providerTxId, null, clientSecret,
            PaymentPresentationMode.CLIENT_SECRET, "CREATED", null);
    }

    /**
     * Checkout <strong>embarqué</strong> par iframe : la page hébergée du provider
     * ({@code redirectUrl}) est rendue dans une {@code <iframe>} + {@code postMessage}.
     * Mode « in-page » des PSP régionaux (PayTabs framed, CMI Pay, PayZone).
     */
    public static PaymentResult iframe(String providerTxId, String redirectUrl) {
        return new PaymentResult(true, providerTxId, redirectUrl, null,
            PaymentPresentationMode.IFRAME, "CREATED", null);
    }

    public static PaymentResult failure(String errorMessage) {
        return new PaymentResult(false, null, null, null, null, "FAILED", errorMessage);
    }
}
