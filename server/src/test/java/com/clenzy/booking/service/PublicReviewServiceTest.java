package com.clenzy.booking.service;

import com.clenzy.booking.dto.PublicReviewsResponse;
import com.clenzy.repository.GuestReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Avis publics : agrégation (moyenne pondérée + total + distribution) sur les avis isPublic=true.
 */
@ExtendWith(MockitoExtension.class)
class PublicReviewServiceTest {

    @Mock private GuestReviewRepository reviewRepository;

    private PublicReviewService service;

    private static final Long ORG = 7L;

    @BeforeEach
    void setUp() {
        service = new PublicReviewService(reviewRepository);
    }

    @Test
    void getReviews_aggregatesWeightedAverageAndTotal() {
        when(reviewRepository.publicRatingDistributionByOrg(eq(ORG)))
                .thenReturn(List.of(new Object[]{5, 8L}, new Object[]{4, 2L}));
        when(reviewRepository.findPublicRecentByOrg(eq(ORG), any(Pageable.class)))
                .thenReturn(List.of());

        PublicReviewsResponse resp = service.getReviews(ORG, 6);

        assertThat(resp.stats().totalCount()).isEqualTo(10L);
        assertThat(resp.stats().averageRating()).isCloseTo(4.8, within(0.001)); // (5*8 + 4*2) / 10
        assertThat(resp.stats().distribution()).containsEntry(5, 8L).containsEntry(4, 2L);
        assertThat(resp.reviews()).isEmpty();
    }

    @Test
    void getReviews_noReviews_returnsZeroes() {
        when(reviewRepository.publicRatingDistributionByOrg(eq(ORG))).thenReturn(List.of());
        when(reviewRepository.findPublicRecentByOrg(eq(ORG), any(Pageable.class))).thenReturn(List.of());

        PublicReviewsResponse resp = service.getReviews(ORG, 6);

        assertThat(resp.stats().totalCount()).isZero();
        assertThat(resp.stats().averageRating()).isZero();
        assertThat(resp.reviews()).isEmpty();
    }
}
