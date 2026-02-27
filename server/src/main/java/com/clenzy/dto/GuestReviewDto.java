package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record GuestReviewDto(
    Long id,
    Long propertyId,
    Long reservationId,
    ChannelName channelName,
    String guestName,
    Integer rating,
    String reviewText,
    String hostResponse,
    Instant hostRespondedAt,
    LocalDate reviewDate,
    Double sentimentScore,
    SentimentLabel sentimentLabel,
    String language,
    List<ReviewTag> tags,
    Boolean isPublic,
    Instant createdAt
) {
    public static GuestReviewDto from(GuestReview r) {
        return new GuestReviewDto(
            r.getId(), r.getPropertyId(), r.getReservationId(), r.getChannelName(),
            r.getGuestName(), r.getRating(), r.getReviewText(), r.getHostResponse(),
            r.getHostRespondedAt(), r.getReviewDate(), r.getSentimentScore(),
            r.getSentimentLabel(), r.getLanguage(), r.getTags(), r.getIsPublic(),
            r.getCreatedAt()
        );
    }
}
