package com.clenzy.integration.expedia.dto;

import java.util.Map;

/**
 * DTO pour les payloads webhook entrants d'Expedia.
 *
 * @param eventType  type d'evenement (reservation.created, availability.updated, etc.)
 * @param propertyId identifiant de la propriete cote Expedia
 * @param data       payload de l'evenement
 * @param timestamp  timestamp ISO-8601 de l'evenement
 */
public record ExpediaWebhookPayload(
        String eventType,
        String propertyId,
        Map<String, Object> data,
        String timestamp
) {
}
