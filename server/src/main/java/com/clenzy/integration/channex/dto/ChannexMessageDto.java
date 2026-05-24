package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;

/**
 * Message guest issu de l'API Channex Messages.
 *
 * <p>Reference : {@code GET /api/v1/bookings/{id}/messages} +
 * {@code GET /api/v1/message_threads/{id}/messages}.</p>
 *
 * <p><b>App payante requise</b> : Messages app activee sur la property
 * cote dashboard Channex.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexMessageDto(
    String id,
    @JsonProperty("thread_id") String threadId,
    @JsonProperty("booking_id") String bookingId,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("channel") String channel,
    String message,
    @JsonProperty("author_type") String authorType,
    @JsonProperty("author_name") String authorName,
    @JsonProperty("inserted_at") Instant insertedAt,
    @JsonProperty("seen_at") Instant seenAt,
    List<ChannexAttachmentDto> attachments
) {}
