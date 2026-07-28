package com.clenzy.service;

import com.clenzy.dto.CreateReviewRequest;
import com.clenzy.dto.ReviewStatsDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.config.KafkaConfig;
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
    private final OutboxPublisher outboxPublisher;

    public ReviewService(GuestReviewRepository reviewRepository,
                         SentimentAnalysisService sentimentService,
                         OutboxPublisher outboxPublisher) {
        this.reviewRepository = reviewRepository;
        this.sentimentService = sentimentService;
        this.outboxPublisher = outboxPublisher;
    }

    /**
     * Signale l'arrivée d'un avis à la constellation d'agents.
     *
     * <p>Écrit dans l'outbox, donc <b>dans la transaction qui enregistre l'avis</b> :
     * un avis persisté sans événement, ou l'inverse, ne peut pas exister. Le relais
     * publie ensuite sur Kafka, et le consommateur fait naître la carte « avis sans
     * réponse ». Sans ce signal, les cartes n'apparaissaient qu'au balayage horaire,
     * ou sur un scan lancé à la main.</p>
     *
     * <p>Un avis déjà répondu ne déclenche rien : il n'appelle aucune action.</p>
     */
    private void announceReview(GuestReview review) {
        if (review.getPropertyId() == null || review.getOrganizationId() == null
                || review.getHostResponse() != null) {
            return;
        }
        outboxPublisher.publish(
                "review",
                String.valueOf(review.getId()),
                "REVIEW_RECEIVED",
                KafkaConfig.TOPIC_REVIEWS_SYNC,
                String.valueOf(review.getPropertyId()),
                String.format("{\"reviewId\":%d,\"propertyId\":%d}",
                        review.getId(), review.getPropertyId()),
                review.getOrganizationId());
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

        GuestReview saved = reviewRepository.save(review);
        announceReview(saved);
        return saved;
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
                // Mise à jour d'un avis déjà connu : rien de neuf à traiter tant
                // qu'il n'a pas reçu de réponse — la dédup par titre couvrirait
                // de toute façon un second signal.
                return reviewRepository.save(e);
            }
        }
        review.setSyncedAt(Instant.now());
        analyzeSentiment(review);
        GuestReview saved = reviewRepository.save(review);
        announceReview(saved);
        return saved;
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
