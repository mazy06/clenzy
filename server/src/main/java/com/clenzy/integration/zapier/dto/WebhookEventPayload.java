package com.clenzy.integration.zapier.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Payload envoye aux abonnes webhook.
 *
 * @param eventType      type d'evenement (ex: RESERVATION_CREATED)
 * @param timestamp      horodatage de l'evenement
 * @param organizationId identifiant de l'organisation source
 * @param data           donnees de l'evenement
 */
public record WebhookEventPayload(
    String eventType,
    Instant timestamp,
    Long organizationId,
    Map<String, Object> data
) {}
