package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Review guest issue de l'API Channex Reviews (Airbnb / Booking / Expedia).
 *
 * <p>Reference : {@code GET /api/v1/reviews}.</p>
 *
 * <p><b>App payante requise</b> : Reviews app (Messages & Reviews) activee
 * sur la property cote dashboard Channex.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexReviewDto(
    String id,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("booking_id") String bookingId,
    String channel,
    @JsonProperty("guest_name") String guestName,
    @JsonProperty("overall_score") Double overallScore,
    @JsonProperty("scale_max") Double scaleMax,
    String comment,
    @JsonProperty("host_reply") String hostReply,
    @JsonProperty("submitted_at") Instant submittedAt,
    @JsonProperty("replied_at") Instant repliedAt
) {}
