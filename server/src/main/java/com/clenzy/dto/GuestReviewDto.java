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
    String hostResponseDraft,
    Instant hostResponseDraftAt,
    LocalDate reviewDate,
    Double sentimentScore,
    SentimentLabel sentimentLabel,
    String language,
    List<ReviewTag> tags,
    Boolean isPublic,
    Instant createdAt,
    /** Photo du voyageur (URL signee), ou {@code null} : repli sur les initiales. */
    String guestAvatarUrl
) {
    /**
     * Avis sans photo de voyageur : les routes d'ECRITURE, qui renvoient l'avis
     * qu'elles viennent de modifier a un appelant qui l'a deja sous les yeux.
     * Les routes de lecture passent la photo, resolue par
     * {@code ReviewGuestAvatarResolver} — a l'unite ou par page.
     */
    public static GuestReviewDto from(GuestReview r) {
        return from(r, null);
    }

    public static GuestReviewDto from(GuestReview r, String guestAvatarUrl) {
        return new GuestReviewDto(
            r.getId(), r.getPropertyId(), r.getReservationId(), r.getChannelName(),
            r.getGuestName(), r.getRating(), r.getReviewText(), r.getHostResponse(),
            r.getHostRespondedAt(), r.getHostResponseDraft(), r.getHostResponseDraftAt(),
            r.getReviewDate(), r.getSentimentScore(),
            r.getSentimentLabel(), r.getLanguage(), r.getTags(), r.getIsPublic(),
            r.getCreatedAt(), guestAvatarUrl
        );
    }
}
