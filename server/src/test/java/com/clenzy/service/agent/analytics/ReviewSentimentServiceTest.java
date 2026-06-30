package com.clenzy.service.agent.analytics;

import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReviewSentimentService — sentiment (note) + thèmes (lexique) des avis")
class ReviewSentimentServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ReviewService reviewService;
    @Mock private TenantContext tenantContext;

    private ReviewSentimentService service;

    @BeforeEach
    void setUp() {
        service = new ReviewSentimentService(reviewService, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Avis citant la propreté avec notes basses → thème propreté NEGATIVE + négatifs non répondus")
    void cleanlinessComplaints_negativeTheme() {
        List<GuestReview> reviews = List.of(
                review(1L, 1, "Logement sale, decevant", null),
                review(2L, 2, "Tres sale, mauvaise hygiene", null),
                review(3L, 5, "Calme et bien situe", "Merci !"));
        when(reviewService.getAll(eq(ORG), any())).thenReturn(page(reviews));

        ReviewSentimentService.AnalysisResult result = service.analyze();

        assertThat(result.totalReviews()).isEqualTo(3);
        assertThat(result.avgRating()).isEqualTo(2.7); // (1+2+5)/3

        ReviewSentimentService.ThemeInsight proprete = theme(result, "propreté");
        assertThat(proprete.mentions()).isEqualTo(2);
        assertThat(proprete.sentiment()).isEqualTo("NEGATIVE");

        assertThat(result.unansweredNegative()).isEqualTo(2);
        assertThat(result.riskReviews()).hasSize(2);
    }

    @Test
    @DisplayName("Avis positifs → thème POSITIVE, aucun risque")
    void positiveReviews_noRisk() {
        List<GuestReview> reviews = List.of(
                review(1L, 5, "Super propre, hote tres reactif", null),
                review(2L, 4, "Bel emplacement, calme", null));
        when(reviewService.getAll(eq(ORG), any())).thenReturn(page(reviews));

        ReviewSentimentService.AnalysisResult result = service.analyze();

        assertThat(result.unansweredNegative()).isZero();
        assertThat(theme(result, "propreté").sentiment()).isEqualTo("POSITIVE");
    }

    @Test
    @DisplayName("Aucun avis → résultat vide")
    void empty_returnsZero() {
        when(reviewService.getAll(eq(ORG), any())).thenReturn(page(List.of()));

        ReviewSentimentService.AnalysisResult result = service.analyze();

        assertThat(result.totalReviews()).isZero();
        assertThat(result.avgRating()).isNull();
        assertThat(result.headline()).contains("Pas encore");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static ReviewSentimentService.ThemeInsight theme(
            ReviewSentimentService.AnalysisResult result, String name) {
        return result.themes().stream()
                .filter(t -> t.theme().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private static Page<GuestReview> page(List<GuestReview> reviews) {
        return new PageImpl<>(reviews);
    }

    private static GuestReview review(Long id, int rating, String text, String hostResponse) {
        GuestReview r = new GuestReview();
        r.setId(id);
        r.setRating(rating);
        r.setReviewText(text);
        r.setReviewDate(LocalDate.of(2026, 6, 15)); // récent (< 90j avant le 2026-07-01)
        r.setHostResponse(hostResponse);
        return r;
    }
}
