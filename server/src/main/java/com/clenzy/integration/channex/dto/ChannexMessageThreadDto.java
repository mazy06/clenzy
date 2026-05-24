package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Thread de conversation guest issu de l'API Channex Messages.
 *
 * <p>Reference : {@code GET /api/v1/message_threads/{id}}.</p>
 *
 * <p><b>App payante requise</b> : Messages app activee sur la property.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexMessageThreadDto(
    String id,
    @JsonProperty("booking_id") String bookingId,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("channel") String channel,
    @JsonProperty("guest_name") String guestName,
    @JsonProperty("guest_email") String guestEmail,
    @JsonProperty("subject") String subject,
    @JsonProperty("last_message_at") Instant lastMessageAt,
    @JsonProperty("unread_count") Integer unreadCount,
    @JsonProperty("status") String status
) {}
