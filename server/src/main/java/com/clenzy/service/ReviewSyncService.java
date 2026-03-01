package com.clenzy.service;

import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.model.GuestReview;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Service de synchronisation des avis guests depuis les channels OTA.
 *
 * Fonctionnalites :
 * - Sync manuelle par propriete (appele depuis ReviewController)
 * - Sync automatique planifiee toutes les 6 heures pour toutes les proprietes
 * - Recupere les avis des 3 derniers mois depuis chaque channel supportant REVIEWS
 */
@Service
public class ReviewSyncService {

    private static final Logger log = LoggerFactory.getLogger(ReviewSyncService.class);

    private final ChannelConnectorRegistry connectorRegistry;
    private final ReviewService reviewService;
    private final PropertyRepository propertyRepository;

    public ReviewSyncService(ChannelConnectorRegistry connectorRegistry,
                             ReviewService reviewService,
                             PropertyRepository propertyRepository) {
        this.connectorRegistry = connectorRegistry;
        this.reviewService = reviewService;
        this.propertyRepository = propertyRepository;
    }

    /**
     * Sync reviews from all OTA channels for a specific property.
     * Called manually via POST /api/reviews/sync/{propertyId}.
     */
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
                if (!reviews.isEmpty()) {
                    log.info("Synced {} reviews from {} for property {}",
                            reviews.size(), connector.getChannelName(), propertyId);
                }
            } catch (Exception e) {
                log.error("Failed to sync reviews from {} for property {}: {}",
                        connector.getChannelName(), propertyId, e.getMessage());
            }
        }
        return totalSynced;
    }

    /**
     * Synchronisation automatique planifiee toutes les 6 heures.
     * Parcourt toutes les proprietes actives et synchronise les avis
     * depuis les channels supportant la capacite REVIEWS.
     *
     * Cron: 0 15 0,6,12,18 * * * (a 00:15, 06:15, 12:15, 18:15)
     */
    @Scheduled(cron = "0 15 0,6,12,18 * * *")
    public void scheduledReviewSync() {
        List<ChannelConnector> connectors = connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS);
        if (connectors.isEmpty()) {
            log.debug("Aucun channel avec capacite REVIEWS configure, sync ignoree");
            return;
        }

        List<Property> properties = propertyRepository.findAll();
        if (properties.isEmpty()) return;

        int totalSynced = 0;
        int propertiesProcessed = 0;
        LocalDate from = LocalDate.now().minusMonths(3);

        for (Property property : properties) {
            try {
                for (ChannelConnector connector : connectors) {
                    try {
                        List<GuestReview> reviews = connector.pullReviews(
                                property.getId(), property.getOrganizationId(), from);
                        for (GuestReview review : reviews) {
                            review.setOrganizationId(property.getOrganizationId());
                            review.setPropertyId(property.getId());
                            reviewService.addOrUpdateFromSync(review);
                            totalSynced++;
                        }
                    } catch (Exception e) {
                        log.warn("Erreur sync reviews {} pour propriete {}: {}",
                                connector.getChannelName(), property.getId(), e.getMessage());
                    }
                }
                propertiesProcessed++;
            } catch (Exception e) {
                log.error("Erreur sync reviews pour propriete {}: {}", property.getId(), e.getMessage());
            }
        }

        if (totalSynced > 0) {
            log.info("ReviewSyncScheduler: {} avis synchronises pour {} proprietes",
                    totalSynced, propertiesProcessed);
        }
    }
}
