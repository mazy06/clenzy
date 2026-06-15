package com.clenzy.dto;

import com.clenzy.model.WebhookDelivery;
import com.clenzy.model.WebhookDelivery.DeliveryStatus;

import java.time.Instant;

/** Entree de journal d'un webhook sortant (CLZ Domaine 10) — pour l'UI d'observabilite. */
public record WebhookDeliveryDto(
        Long id,
        Long webhookId,
        String eventType,
        DeliveryStatus status,
        int attempts,
        Instant nextAttemptAt,
        Integer responseStatus,
        String lastError,
        Instant createdAt,
        Instant deliveredAt
) {
    public static WebhookDeliveryDto from(WebhookDelivery d) {
        return new WebhookDeliveryDto(
                d.getId(), d.getWebhookId(), d.getEventType(), d.getStatus(), d.getAttempts(),
                d.getNextAttemptAt(), d.getResponseStatus(), d.getLastError(), d.getCreatedAt(), d.getDeliveredAt());
    }
}
