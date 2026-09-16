package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Reprise durable, y compris après redémarrage ; le verrou de demande évite les doublons. */
@Component
public class MarketplaceQuoteDiscussionScheduler {
    private static final Logger log = LoggerFactory.getLogger(MarketplaceQuoteDiscussionScheduler.class);
    private final MarketplaceQuoteRequestRepository requests;
    private final MarketplaceQuoteDiscussionPublisher publisher;

    public MarketplaceQuoteDiscussionScheduler(MarketplaceQuoteRequestRepository requests,
                                               MarketplaceQuoteDiscussionPublisher publisher) {
        this.requests = requests; this.publisher = publisher;
    }

    @Scheduled(fixedDelayString = "${baitly.marketplace.discussions.delay-ms:5000}")
    public void publishPending() {
        for (Long id : requests.findPendingDiscussions()) {
            try { publisher.publish(id); }
            catch (Exception failure) {
                requests.deferDiscussion(id);
                log.warn("Publication de la demande {} à reprendre", id, failure);
            }
        }
    }
}
