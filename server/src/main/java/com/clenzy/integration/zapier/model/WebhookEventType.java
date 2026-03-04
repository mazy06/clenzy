package com.clenzy.integration.zapier.model;

/**
 * Types d'evenements webhook disponibles pour les abonnements.
 */
public enum WebhookEventType {
    RESERVATION_CREATED,
    RESERVATION_UPDATED,
    GUEST_CHECKIN,
    GUEST_CHECKOUT,
    INTERVENTION_COMPLETED,
    MESSAGE_SENT,
    INVOICE_GENERATED
}
