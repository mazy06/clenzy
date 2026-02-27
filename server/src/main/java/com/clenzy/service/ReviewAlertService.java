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
                    "/reviews"
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
