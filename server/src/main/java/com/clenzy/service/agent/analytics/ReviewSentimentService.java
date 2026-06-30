package com.clenzy.service.agent.analytics;

import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Analyse de sentiment et de thèmes des avis voyageurs (P0-4) — agent {@code rep}.
 *
 * <p>v1 déterministe (sans appel LLM) : le sentiment vient de la <b>note</b> (1-5),
 * les thèmes d'un <b>lexique</b> (propreté, bruit, arrivée, équipements,
 * qualité-prix, emplacement, communication) matché sur le texte normalisé (sans
 * accents). Remonte les thèmes récurrents, la tendance, et les avis à risque
 * réputationnel (note basse non répondue). Read-only, org-scopée.</p>
 *
 * <p>Affinage futur : extraction de sentiment fine par LLM (cache + batch).</p>
 */
@Service
public class ReviewSentimentService {

    private static final int MAX_REVIEWS = 200;
    private static final int RECENT_DAYS = 90;
    private static final int MAX_RISK_REVIEWS = 5;
    private static final int RISK_RATING = 2;

    /** Thème → racines de mots (lowercase, sans accents). */
    private static final Map<String, List<String>> THEMES = Map.of(
            "propreté", List.of("propr", "sale", "salete", "nettoy", "clean", "dirty", "hygien"),
            "bruit", List.of("bruit", "bruyant", "calme", "silenc", "noise", "quiet", "voisin"),
            "arrivée", List.of("check", "arriv", "cle ", "cles", "acces", "code", "key", "entree"),
            "équipements", List.of("wifi", "internet", "cuisine", "piscine", "clim", "chauffage",
                    "equip", "douche", "machine"),
            "qualité-prix", List.of("prix", "cher", "qualite-prix", "value", "abordable", "overpriced"),
            "emplacement", List.of("emplacement", "quartier", "situe", "central", "localisation", "proche"),
            "communication", List.of("communic", "reactif", "repons", "hote", "host", "joignable"));

    private final ReviewService reviewService;
    private final TenantContext tenantContext;
    private final Clock clock;

    public ReviewSentimentService(ReviewService reviewService,
                                  TenantContext tenantContext,
                                  Clock clock) {
        this.reviewService = reviewService;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record ThemeInsight(String theme, int mentions, Double avgRating, String sentiment) {}

    public record RiskReview(Long id, Integer rating, String comment, Long propertyId,
                             String channel, boolean hasHostResponse, String date) {}

    public record AnalysisResult(
            int totalReviews,
            Double avgRating,
            Map<String, Integer> ratingDistribution,
            Double recentAvgRating,
            int recentCount,
            List<ThemeInsight> themes,
            int unansweredNegative,
            List<RiskReview> riskReviews,
            String headline) {}

    @Transactional(readOnly = true)
    public AnalysisResult analyze() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate cutoff = LocalDate.now(clock).minusDays(RECENT_DAYS);

        Page<GuestReview> page = reviewService.getAll(orgId,
                PageRequest.of(0, MAX_REVIEWS, Sort.by(Sort.Direction.DESC, "reviewDate")));
        List<GuestReview> reviews = page.getContent();

        if (reviews.isEmpty()) {
            return new AnalysisResult(0, null, emptyDistribution(), null, 0,
                    List.of(), 0, List.of(), "Pas encore d'avis sur la période.");
        }

        Map<String, Integer> distribution = emptyDistribution();
        long ratingSum = 0;
        int ratingCount = 0;
        long recentSum = 0;
        int recentCount = 0;
        int unansweredNegative = 0;

        // Accumulateurs par thème : [mentions, ratingSum, ratingCount].
        Map<String, int[]> themeAcc = new LinkedHashMap<>();
        for (String t : THEMES.keySet()) {
            themeAcc.put(t, new int[3]);
        }
        List<RiskReview> risks = new ArrayList<>();

        for (GuestReview r : reviews) {
            Integer rating = r.getRating();
            if (rating != null) {
                ratingSum += rating;
                ratingCount++;
                distribution.computeIfPresent(String.valueOf(clampRating(rating)), (k, v) -> v + 1);
                if (r.getReviewDate() != null && !r.getReviewDate().isBefore(cutoff)) {
                    recentSum += rating;
                    recentCount++;
                }
            }

            boolean negative = rating != null && rating <= RISK_RATING;
            boolean answered = r.getHostResponse() != null && !r.getHostResponse().isBlank();
            if (negative && !answered) {
                unansweredNegative++;
                if (risks.size() < MAX_RISK_REVIEWS) {
                    risks.add(toRiskReview(r));
                }
            }

            String norm = normalize(r.getReviewText());
            if (!norm.isBlank()) {
                for (Map.Entry<String, List<String>> theme : THEMES.entrySet()) {
                    if (matches(norm, theme.getValue())) {
                        int[] acc = themeAcc.get(theme.getKey());
                        acc[0]++; // mentions
                        if (rating != null) {
                            acc[1] += rating;
                            acc[2]++;
                        }
                    }
                }
            }
        }

        List<ThemeInsight> themes = new ArrayList<>();
        for (Map.Entry<String, int[]> e : themeAcc.entrySet()) {
            int[] acc = e.getValue();
            if (acc[0] == 0) {
                continue; // thème non mentionné
            }
            Double avg = acc[2] > 0 ? round1((double) acc[1] / acc[2]) : null;
            themes.add(new ThemeInsight(e.getKey(), acc[0], avg, sentiment(avg)));
        }
        themes.sort((a, b) -> Integer.compare(b.mentions(), a.mentions()));

        Double avgRating = ratingCount > 0 ? round1((double) ratingSum / ratingCount) : null;
        Double recentAvg = recentCount > 0 ? round1((double) recentSum / recentCount) : null;

        return new AnalysisResult(reviews.size(), avgRating, distribution, recentAvg, recentCount,
                themes, unansweredNegative, risks,
                headline(avgRating, reviews.size(), unansweredNegative, themes));
    }

    private static String headline(Double avg, int total, int unanswered, List<ThemeInsight> themes) {
        StringBuilder sb = new StringBuilder();
        sb.append(avg != null ? "Note moyenne " + avg + "/5 sur " + total + " avis." : total + " avis.");
        ThemeInsight worst = themes.stream()
                .filter(t -> "NEGATIVE".equals(t.sentiment()) || "MIXED".equals(t.sentiment()))
                .min((a, b) -> Double.compare(
                        a.avgRating() != null ? a.avgRating() : 5.0,
                        b.avgRating() != null ? b.avgRating() : 5.0))
                .orElse(null);
        if (worst != null) {
            sb.append(" Thème à surveiller : ").append(worst.theme())
                    .append(worst.avgRating() != null ? " (" + worst.avgRating() + "/5)" : "").append('.');
        }
        if (unanswered > 0) {
            sb.append(' ').append(unanswered).append(" avis négatif(s) sans réponse.");
        }
        return sb.toString();
    }

    private RiskReview toRiskReview(GuestReview r) {
        String comment = r.getReviewText();
        if (comment != null && comment.length() > 200) {
            comment = comment.substring(0, 200).strip() + "…";
        }
        return new RiskReview(r.getId(), r.getRating(), comment, r.getPropertyId(),
                r.getChannelName() != null ? r.getChannelName().name() : null,
                r.getHostResponse() != null && !r.getHostResponse().isBlank(),
                r.getReviewDate() != null ? r.getReviewDate().toString() : null);
    }

    private static boolean matches(String norm, List<String> keywords) {
        for (String k : keywords) {
            if (norm.contains(k)) {
                return true;
            }
        }
        return false;
    }

    private static String sentiment(Double avg) {
        if (avg == null) {
            return "UNKNOWN";
        }
        if (avg >= 4.0) {
            return "POSITIVE";
        }
        if (avg <= 2.5) {
            return "NEGATIVE";
        }
        return "MIXED";
    }

    private static String normalize(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String stripped = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return stripped.toLowerCase();
    }

    private static int clampRating(int rating) {
        return Math.max(1, Math.min(rating, 5));
    }

    private static Map<String, Integer> emptyDistribution() {
        Map<String, Integer> d = new TreeMap<>();
        for (int i = 1; i <= 5; i++) {
            d.put(String.valueOf(i), 0);
        }
        return d;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
