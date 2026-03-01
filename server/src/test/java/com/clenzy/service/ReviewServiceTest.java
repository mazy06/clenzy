package com.clenzy.service;

import com.clenzy.dto.CreateReviewRequest;
import com.clenzy.dto.ReviewStatsDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.SentimentAnalysisService.SentimentResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock private GuestReviewRepository reviewRepository;
    @Mock private SentimentAnalysisService sentimentService;

    @InjectMocks
    private ReviewService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private GuestReview sampleReview;

    @BeforeEach
    void setUp() {
        sampleReview = new GuestReview();
        sampleReview.setId(1L);
        sampleReview.setOrganizationId(ORG_ID);
        sampleReview.setPropertyId(PROPERTY_ID);
        sampleReview.setChannelName(ChannelName.AIRBNB);
        sampleReview.setGuestName("John Doe");
        sampleReview.setRating(4);
        sampleReview.setReviewText("Great place, very clean!");
        sampleReview.setReviewDate(LocalDate.of(2025, 6, 15));
        sampleReview.setLanguage("en");
    }

    @Test
    void addReview_setsSentimentAndSaves() {
        var request = new CreateReviewRequest(PROPERTY_ID, null, ChannelName.AIRBNB,
            "Jane", 5, "Amazing stay!", LocalDate.now(), "en");

        when(sentimentService.analyze("Amazing stay!", "en"))
            .thenReturn(new SentimentResult(0.8, SentimentLabel.POSITIVE, List.of(ReviewTag.COMFORT)));
        when(reviewRepository.save(any(GuestReview.class)))
            .thenAnswer(inv -> {
                GuestReview r = inv.getArgument(0);
                r.setId(10L);
                return r;
            });

        GuestReview result = service.addReview(request, ORG_ID);

        assertNotNull(result);
        assertEquals(ORG_ID, result.getOrganizationId());
        assertEquals(PROPERTY_ID, result.getPropertyId());
        assertEquals(5, result.getRating());
        assertEquals(SentimentLabel.POSITIVE, result.getSentimentLabel());
        assertEquals(0.8, result.getSentimentScore());
        assertEquals(List.of(ReviewTag.COMFORT), result.getTags());
    }

    @Test
    void addReview_withNullText_skipsAnalysis() {
        var request = new CreateReviewRequest(PROPERTY_ID, null, ChannelName.BOOKING,
            "Guest", 3, null, LocalDate.now(), "en");

        when(reviewRepository.save(any(GuestReview.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        GuestReview result = service.addReview(request, ORG_ID);

        assertNull(result.getSentimentLabel());
        assertNull(result.getSentimentScore());
        verifyNoInteractions(sentimentService);
    }

    @Test
    void getById_found_returnsReview() {
        when(reviewRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(sampleReview));

        GuestReview result = service.getById(1L, ORG_ID);

        assertEquals(sampleReview, result);
    }

    @Test
    void getById_notFound_throwsException() {
        when(reviewRepository.findByIdAndOrgId(999L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getById(999L, ORG_ID));
    }

    @Test
    void respondToReview_setsHostResponse() {
        when(reviewRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(sampleReview));
        when(reviewRepository.save(any(GuestReview.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestReview result = service.respondToReview(1L, ORG_ID, "Thank you!");

        assertEquals("Thank you!", result.getHostResponse());
        assertNotNull(result.getHostRespondedAt());
    }

    @Test
    void addOrUpdateFromSync_newReview_createsNew() {
        GuestReview synced = new GuestReview();
        synced.setOrganizationId(ORG_ID);
        synced.setPropertyId(PROPERTY_ID);
        synced.setExternalReviewId("ext-123");
        synced.setRating(4);
        synced.setReviewText("Good place");
        synced.setLanguage("en");

        when(reviewRepository.findByExternalReviewIdAndOrganizationId("ext-123", ORG_ID))
            .thenReturn(Optional.empty());
        when(sentimentService.analyze("Good place", "en"))
            .thenReturn(new SentimentResult(0.5, SentimentLabel.POSITIVE, List.of()));
        when(reviewRepository.save(any(GuestReview.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestReview result = service.addOrUpdateFromSync(synced);

        assertNotNull(result.getSyncedAt());
        assertEquals(SentimentLabel.POSITIVE, result.getSentimentLabel());
    }

    @Test
    void addOrUpdateFromSync_existingReview_updatesExisting() {
        GuestReview synced = new GuestReview();
        synced.setOrganizationId(ORG_ID);
        synced.setExternalReviewId("ext-123");
        synced.setRating(3);
        synced.setReviewText("Updated review");
        synced.setGuestName("Updated Guest");
        synced.setLanguage("en");

        when(reviewRepository.findByExternalReviewIdAndOrganizationId("ext-123", ORG_ID))
            .thenReturn(Optional.of(sampleReview));
        when(sentimentService.analyze("Updated review", "en"))
            .thenReturn(new SentimentResult(0.0, SentimentLabel.NEUTRAL, List.of()));
        when(reviewRepository.save(any(GuestReview.class))).thenAnswer(inv -> inv.getArgument(0));

        GuestReview result = service.addOrUpdateFromSync(synced);

        assertEquals(3, result.getRating());
        assertEquals("Updated review", result.getReviewText());
        assertEquals("Updated Guest", result.getGuestName());
        assertNotNull(result.getSyncedAt());
    }

    @Test
    void getStats_aggregatesCorrectly() {
        when(reviewRepository.averageRatingByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(4.2);
        when(reviewRepository.countByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(50L);
        when(reviewRepository.countByPropertyIdGroupByRating(PROPERTY_ID, ORG_ID))
            .thenReturn(List.of(
                new Object[]{5, 20L},
                new Object[]{4, 15L},
                new Object[]{3, 10L}
            ));
        when(reviewRepository.countByPropertyIdGroupBySentiment(PROPERTY_ID, ORG_ID))
            .thenReturn(List.of(
                new Object[]{SentimentLabel.POSITIVE, 30L},
                new Object[]{SentimentLabel.NEUTRAL, 15L}
            ));

        ReviewStatsDto stats = service.getStats(PROPERTY_ID, ORG_ID);

        assertEquals(PROPERTY_ID, stats.propertyId());
        assertEquals(4.2, stats.averageRating());
        assertEquals(50L, stats.totalReviews());
        assertEquals(20L, stats.ratingDistribution().get(5));
        assertEquals(15L, stats.ratingDistribution().get(4));
        assertEquals(10L, stats.ratingDistribution().get(3));
        assertEquals(0L, stats.ratingDistribution().get(2));
        assertEquals(0L, stats.ratingDistribution().get(1));
        assertEquals(30L, stats.sentimentBreakdown().get(SentimentLabel.POSITIVE));
        assertEquals(15L, stats.sentimentBreakdown().get(SentimentLabel.NEUTRAL));
        assertEquals(0L, stats.sentimentBreakdown().get(SentimentLabel.NEGATIVE));
    }

    @Test
    void getByProperty_returnsPaginatedResults() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<GuestReview> page = new PageImpl<>(List.of(sampleReview));
        when(reviewRepository.findByPropertyId(PROPERTY_ID, ORG_ID, pageable)).thenReturn(page);

        Page<GuestReview> result = service.getByProperty(PROPERTY_ID, ORG_ID, pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(sampleReview, result.getContent().get(0));
    }
}
