package com.clenzy.booking.dto;

import com.clenzy.model.GuestReview;
import java.time.LocalDate;

/**
 * Avis public d'un guest, expose via le Booking Engine.
 * Ne contient aucune donnee sensible (pas d'ID interne, pas de channel).
 */
public record PublicReviewDto(
        String guestName,
        Integer rating,
        String reviewText,
        String hostResponse,
        LocalDate reviewDate
) {
    public static PublicReviewDto from(GuestReview r) {
        return new PublicReviewDto(
                r.getGuestName(),
                r.getRating(),
                r.getReviewText(),
                r.getHostResponse(),
                r.getReviewDate()
        );
    }
}
