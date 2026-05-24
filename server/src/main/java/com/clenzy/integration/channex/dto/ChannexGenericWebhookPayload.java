package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

/**
 * Payload generique d'un webhook Channex (events whitelabel non-booking).
 *
 * <p>Distinct de {@link ChannexWebhookPayload} qui est type pour les
 * bookings. Ici le payload reste JsonNode car les events sont varies :</p>
 * <ul>
 *   <li>{@code listing_updated} — host a modifie son listing OTA
 *       (nom, description, photos, amenities) → permet re-sync auto
 *       sans avoir a re-scraper</li>
 *   <li>{@code content_updated} — content d'une property modifie cote Channex</li>
 *   <li>{@code property_updated} — changements sur la property elle-meme</li>
 *   <li>{@code sync_error} — erreur de push vers un OTA</li>
 *   <li>{@code new_channel} / {@code updated_channel} / {@code disconnect_listing}</li>
 * </ul>
 *
 * <p><b>Capability</b> : {@link com.clenzy.integration.channex.service.ChannexCapabilityService.Capability#WEBHOOKS}
 * (auto-detect runtime, pas de config).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexGenericWebhookPayload(
    String event,
    String resourceId,
    String resourceType,
    JsonNode payload,
    Instant timestamp,
    String userId
) {}
