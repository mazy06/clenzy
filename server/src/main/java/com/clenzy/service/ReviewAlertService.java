package com.clenzy.service;

import com.clenzy.model.GuestReview;
import com.clenzy.model.NotificationKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReviewAlertService {

    private static final Logger log = LoggerFactory.getLogger(ReviewAlertService.class);
    private static final int DEFAULT_ALERT_THRESHOLD = 3;

    private final ReviewService reviewService;
    private final NotificationService notificationService;

    public ReviewAlertService(ReviewService reviewService,
                              NotificationService notificationService) {
        this.reviewService = reviewService;
        this.notificationService = notificationService;
    }

    public int checkAndAlertNegativeReviews(Long orgId) {
        return checkAndAlertNegativeReviews(orgId, DEFAULT_ALERT_THRESHOLD);
    }

    public int checkAndAlertNegativeReviews(Long orgId, int threshold) {
        List<GuestReview> negativeReviews = reviewService.findNegativeWithoutResponse(orgId, threshold);
        int alertCount = 0;

        for (GuestReview review : negativeReviews) {
            try {
                String message = String.format("Avis negatif (%d/5) de %s sur la propriete %d: %s",
                    review.getRating(), review.getGuestName(), review.getPropertyId(),
                    truncate(review.getReviewText(), 100));

                notificationService.notifyAdminsAndManagers(
                    NotificationKey.REVIEW_NEGATIVE_ALERT,
                    "Avis negatif recu",
                    message,
                    "/channels/reviews?highlight=" + review.getId(),
                    // L'identifiant permet a la fiche d'aller chercher l'avis
                    // ENTIER — le message n'en porte que cent caracteres.
                    NotificationMetadata.of()
                        .guest(review.getGuestName())
                        .rating(review.getRating())
                        .reviewId(review.getId())
                        .propertyId(review.getPropertyId())
                        .build()
                );
                alertCount++;
            } catch (Exception e) {
                log.error("Failed to create alert for review {}: {}", review.getId(), e.getMessage());
            }
        }

        if (alertCount > 0) {
            log.info("Created {} negative review alerts for org {}", alertCount, orgId);
        }
        return alertCount;
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
