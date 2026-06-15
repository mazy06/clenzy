package com.clenzy.model;

/**
 * Taxonomie des evenements emis vers les webhooks sortants (CLZ Domaine 10). Le {@code wireName}
 * est la valeur stable exposee aux abonnes (et stockee dans {@code WebhookConfig.events}).
 */
public enum WebhookEventType {
    RESERVATION_CREATED("reservation.created"),
    RESERVATION_CANCELLED("reservation.cancelled"),
    PAYMENT_CONFIRMED("payment.confirmed");

    private final String wireName;

    WebhookEventType(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }
}
