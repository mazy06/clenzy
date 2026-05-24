package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Score agrege d'une property (toutes OTAs) + detail per-OTA optionnel.
 *
 * <p>Reference : {@code GET /api/v1/scores/{property_id}} (agrege) +
 * {@code GET /api/v1/scores/{property_id}/detailed} (per OTA).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexScoreDto(
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("overall_score") Double overallScore,
    @JsonProperty("scale_max") Double scaleMax,
    @JsonProperty("reviews_count") Integer reviewsCount,
    @JsonProperty("by_channel") Map<String, ChannelScore> byChannel,
    @JsonProperty("recent_reviews") List<ChannexReviewDto> recentReviews
) {
    /** Score breakdown pour 1 OTA (Airbnb / Booking / Expedia). */
    public record ChannelScore(
        Double score,
        Integer count,
        @JsonProperty("scale_max") Double scaleMax
    ) {}
}
