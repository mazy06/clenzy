package com.clenzy.service;

import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.model.GuestReview;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ReviewSyncService {

    private static final Logger log = LoggerFactory.getLogger(ReviewSyncService.class);

    private final ChannelConnectorRegistry connectorRegistry;
    private final ReviewService reviewService;

    public ReviewSyncService(ChannelConnectorRegistry connectorRegistry,
                             ReviewService reviewService) {
        this.connectorRegistry = connectorRegistry;
        this.reviewService = reviewService;
    }

    public int syncReviewsForProperty(Long propertyId, Long orgId) {
        int totalSynced = 0;
        LocalDate from = LocalDate.now().minusMonths(3);

        List<ChannelConnector> connectors = connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS);
        for (ChannelConnector connector : connectors) {
            try {
                List<GuestReview> reviews = connector.pullReviews(propertyId, orgId, from);
                for (GuestReview review : reviews) {
                    review.setOrganizationId(orgId);
                    review.setPropertyId(propertyId);
                    reviewService.addOrUpdateFromSync(review);
                    totalSynced++;
                }
                log.info("Synced {} reviews from {} for property {}", reviews.size(), connector.getChannelName(), propertyId);
            } catch (Exception e) {
                log.error("Failed to sync reviews from {} for property {}: {}", connector.getChannelName(), propertyId, e.getMessage());
            }
        }
        return totalSynced;
    }
}
