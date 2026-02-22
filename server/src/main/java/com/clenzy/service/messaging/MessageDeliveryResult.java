package com.clenzy.service.messaging;

/**
 * Resultat d'un envoi de message.
 */
public record MessageDeliveryResult(
    boolean success,
    String providerMessageId,
    String errorMessage
) {
    public static MessageDeliveryResult success(String providerMessageId) {
        return new MessageDeliveryResult(true, providerMessageId, null);
    }

    public static MessageDeliveryResult failure(String errorMessage) {
        return new MessageDeliveryResult(false, null, errorMessage);
    }
}
