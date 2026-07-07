package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GuestReviewDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        Instant respondedAt = Instant.parse("2026-05-01T10:00:00Z");
        Instant createdAt = Instant.parse("2026-04-30T09:00:00Z");
        LocalDate reviewDate = LocalDate.of(2026, 4, 28);
        List<ReviewTag> tags = List.of(ReviewTag.CLEANLINESS, ReviewTag.LOCATION);

        GuestReviewDto dto = new GuestReviewDto(
                1L, 10L, 100L,
                ChannelName.AIRBNB,
                "John Doe",
                5,
                "Great stay!",
                "Thank you!",
                respondedAt,
                null,
                null,
                reviewDate,
                0.95,
                SentimentLabel.POSITIVE,
                "en",
                tags,
                true,
                createdAt
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.propertyId());
        assertEquals(100L, dto.reservationId());
        assertEquals(ChannelName.AIRBNB, dto.channelName());
        assertEquals("John Doe", dto.guestName());
        assertEquals(5, dto.rating());
        assertEquals("Great stay!", dto.reviewText());
        assertEquals("Thank you!", dto.hostResponse());
        assertEquals(respondedAt, dto.hostRespondedAt());
        assertEquals(reviewDate, dto.reviewDate());
        assertEquals(0.95, dto.sentimentScore());
        assertEquals(SentimentLabel.POSITIVE, dto.sentimentLabel());
        assertEquals("en", dto.language());
        assertEquals(tags, dto.tags());
        assertTrue(dto.isPublic());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_mapsAllEntityFields() {
        Instant respondedAt = Instant.parse("2026-05-01T10:00:00Z");
        LocalDate reviewDate = LocalDate.of(2026, 4, 28);
        List<ReviewTag> tags = List.of(ReviewTag.VALUE, ReviewTag.COMMUNICATION);

        GuestReview review = new GuestReview();
        review.setId(42L);
        review.setPropertyId(7L);
        review.setReservationId(123L);
        review.setChannelName(ChannelName.BOOKING);
        review.setGuestName("Alice");
        review.setRating(4);
        review.setReviewText("Nice place");
        review.setHostResponse("Thanks");
        review.setHostRespondedAt(respondedAt);
        review.setReviewDate(reviewDate);
        review.setSentimentScore(0.6);
        review.setSentimentLabel(SentimentLabel.POSITIVE);
        review.setLanguage("fr");
        review.setTags(tags);
        review.setIsPublic(false);

        GuestReviewDto dto = GuestReviewDto.from(review);

        assertEquals(42L, dto.id());
        assertEquals(7L, dto.propertyId());
        assertEquals(123L, dto.reservationId());
        assertEquals(ChannelName.BOOKING, dto.channelName());
        assertEquals("Alice", dto.guestName());
        assertEquals(4, dto.rating());
        assertEquals("Nice place", dto.reviewText());
        assertEquals("Thanks", dto.hostResponse());
        assertEquals(respondedAt, dto.hostRespondedAt());
        assertEquals(reviewDate, dto.reviewDate());
        assertEquals(0.6, dto.sentimentScore());
        assertEquals(SentimentLabel.POSITIVE, dto.sentimentLabel());
        assertEquals("fr", dto.language());
        assertEquals(tags, dto.tags());
        assertFalse(dto.isPublic());
        // createdAt set by @PrePersist — may be null in unit test without persistence
        assertNull(dto.createdAt());
    }

    @Test
    void from_withMinimalEntity_returnsDtoWithNulls() {
        GuestReview review = new GuestReview();
        review.setRating(3);

        GuestReviewDto dto = GuestReviewDto.from(review);

        assertNull(dto.id());
        assertNull(dto.propertyId());
        assertEquals(3, dto.rating());
        assertNull(dto.reviewText());
        assertNull(dto.sentimentLabel());
    }
}
