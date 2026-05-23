package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Payload generique d'un webhook Channex.
 *
 * <p>Channex envoie plusieurs types d'evenements :</p>
 * <ul>
 *   <li>{@code booking_new} — nouvelle reservation OTA</li>
 *   <li>{@code booking_modification} — modification d'une reservation existante</li>
 *   <li>{@code booking_cancellation} — annulation</li>
 *   <li>{@code channel_message} — message OTA -> guest a relayer</li>
 *   <li>{@code review_received} — nouveau review post-sejour</li>
 * </ul>
 *
 * <p>Le payload du booking est dans le champ {@code payload}, deserialise en
 * {@link ChannexBookingDto} pour les evenements de type booking_*.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexWebhookPayload(
    @JsonProperty("event") String event,
    @JsonProperty("timestamp") Instant timestamp,
    @JsonProperty("user_id") String userId,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("payload") ChannexBookingDto payload
) {}
