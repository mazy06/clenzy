package com.clenzy.service;

import com.clenzy.dto.CreateReviewRequest;
import com.clenzy.dto.ReviewStatsDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.model.SentimentLabel;
import com.clenzy.repository.GuestReviewRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class ReviewService {

    private final GuestReviewRepository reviewRepository;
    private final SentimentAnalysisService sentimentService;

    public ReviewService(GuestReviewRepository reviewRepository,
                         SentimentAnalysisService sentimentService) {
        this.reviewRepository = reviewRepository;
        this.sentimentService = sentimentService;
    }

    public Page<GuestReview> getByProperty(Long propertyId, Long orgId, Pageable pageable) {
        return reviewRepository.findByPropertyId(propertyId, orgId, pageable);
    }

    public Page<GuestReview> getByChannel(ChannelName channel, Long orgId, Pageable pageable) {
        return reviewRepository.findByChannelName(channel, orgId, pageable);
    }

    public Page<GuestReview> getAll(Long orgId, Pageable pageable) {
        return reviewRepository.findAllByOrgId(orgId, pageable);
    }

    public GuestReview getById(Long id, Long orgId) {
        return reviewRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Review not found: " + id));
    }

    @Transactional
    public GuestReview addReview(CreateReviewRequest request, Long orgId) {
        GuestReview review = new GuestReview();
        review.setOrganizationId(orgId);
        review.setPropertyId(request.propertyId());
        review.setReservationId(request.reservationId());
        review.setChannelName(request.channelName());
        review.setGuestName(request.guestName());
        review.setRating(request.rating());
        review.setReviewText(request.reviewText());
        review.setReviewDate(request.reviewDate());
        review.setLanguage(request.language());

        analyzeSentiment(review);

        return reviewRepository.save(review);
    }

    @Transactional
    public GuestReview addOrUpdateFromSync(GuestReview review) {
        if (review.getExternalReviewId() != null) {
            var existing = reviewRepository.findByExternalReviewIdAndOrganizationId(
                review.getExternalReviewId(), review.getOrganizationId());
            if (existing.isPresent()) {
                GuestReview e = existing.get();
                e.setRating(review.getRating());
                e.setReviewText(review.getReviewText());
                e.setGuestName(review.getGuestName());
                e.setSyncedAt(Instant.now());
                analyzeSentiment(e);
                return reviewRepository.save(e);
            }
        }
        review.setSyncedAt(Instant.now());
        analyzeSentiment(review);
        return reviewRepository.save(review);
    }

    @Transactional
    public GuestReview respondToReview(Long id, Long orgId, String response) {
        GuestReview review = getById(id, orgId);
        review.setHostResponse(response);
        review.setHostRespondedAt(Instant.now());
        return reviewRepository.save(review);
    }

    public ReviewStatsDto getStats(Long propertyId, Long orgId) {
        Double avgRating = reviewRepository.averageRatingByPropertyId(propertyId, orgId);
        long totalReviews = reviewRepository.countByPropertyId(propertyId, orgId);

        Map<Integer, Long> ratingDistribution = new HashMap<>();
        for (int i = 1; i <= 5; i++) ratingDistribution.put(i, 0L);
        for (Object[] row : reviewRepository.countByPropertyIdGroupByRating(propertyId, orgId)) {
            ratingDistribution.put((Integer) row[0], (Long) row[1]);
        }

        Map<SentimentLabel, Long> sentimentBreakdown = new HashMap<>();
        for (SentimentLabel label : SentimentLabel.values()) sentimentBreakdown.put(label, 0L);
        for (Object[] row : reviewRepository.countByPropertyIdGroupBySentiment(propertyId, orgId)) {
            sentimentBreakdown.put((SentimentLabel) row[0], (Long) row[1]);
        }

        return new ReviewStatsDto(propertyId, avgRating, totalReviews, ratingDistribution, sentimentBreakdown);
    }

    public List<GuestReview> findNegativeWithoutResponse(Long orgId, int threshold) {
        return reviewRepository.findNegativeWithoutResponse(threshold, orgId);
    }

    public List<GuestReview> getByPropertyAndDateRange(Long propertyId, Long orgId, LocalDate from, LocalDate to) {
        return reviewRepository.findByPropertyIdAndDateRange(propertyId, orgId, from, to);
    }

    private void analyzeSentiment(GuestReview review) {
        if (review.getReviewText() != null && !review.getReviewText().isBlank()) {
            var result = sentimentService.analyze(review.getReviewText(), review.getLanguage());
            review.setSentimentScore(result.score());
            review.setSentimentLabel(result.label());
            review.setTags(result.tags());
        }
    }
}
