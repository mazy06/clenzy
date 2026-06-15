package com.clenzy.booking.service;

import com.clenzy.booking.dto.PublicReviewDto;
import com.clenzy.booking.dto.PublicReviewsResponse;
import com.clenzy.booking.dto.ReviewStatsDto;
import com.clenzy.repository.GuestReviewRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Avis publics exposés par le booking engine (CLZ Domaine 2 — preuve sociale). Org-scopé
 * (org résolue par la clé API côté controller). N'expose QUE les avis {@code isPublic = true}.
 */
@Service
public class PublicReviewService {

    private final GuestReviewRepository reviewRepository;

    public PublicReviewService(GuestReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
    }

    @Transactional(readOnly = true)
    public PublicReviewsResponse getReviews(Long orgId, int limit) {
        ReviewStatsDto stats = computeStats(orgId);
        List<PublicReviewDto> recent = reviewRepository
                .findPublicRecentByOrg(orgId, PageRequest.of(0, Math.max(1, Math.min(limit, 50))))
                .stream()
                .map(PublicReviewDto::from)
                .toList();
        return new PublicReviewsResponse(stats, recent);
    }

    /** Moyenne + total + distribution à partir d'une seule requête group-by-rating (avis publics). */
    private ReviewStatsDto computeStats(Long orgId) {
        List<Object[]> rows = reviewRepository.publicRatingDistributionByOrg(orgId);
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        long total = 0L;
        long weighted = 0L;
        for (Object[] row : rows) {
            int rating = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            distribution.put(rating, count);
            total += count;
            weighted += (long) rating * count;
        }
        double average = total == 0 ? 0.0
                : BigDecimal.valueOf((double) weighted / total).setScale(2, RoundingMode.HALF_UP).doubleValue();
        return new ReviewStatsDto(average, total, distribution);
    }
}
