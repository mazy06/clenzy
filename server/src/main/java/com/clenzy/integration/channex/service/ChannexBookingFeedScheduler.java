package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.config.ChannexProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

/**
 * Rattrapage periodique du feed de booking revisions Channex.
 *
 * <p>Les webhooks sont le declencheur nominal ({@link ChannexBookingFeedService}
 * est appele par le webhook controller) ; ce scheduler garantit la resilience
 * exigee par la doc Channex : redemarrage de l'application, webhook manque
 * (endpoint down &gt; 24 h de retries Channex), desordre de livraison. Le feed
 * ne re-sert QUE les revisions non acquittees → un passage a vide est quasi
 * gratuit (1 appel GET).</p>
 *
 * <p>Intervalle : {@code clenzy.channex.booking-feed-interval-minutes}
 * (defaut 10 min), premiere passe 2 min apres le boot (catch-up).</p>
 */
@Component
public class ChannexBookingFeedScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannexBookingFeedScheduler.class);

    private final ChannexBookingFeedService feedService;
    private final ChannexProperties props;

    public ChannexBookingFeedScheduler(ChannexBookingFeedService feedService,
                                       ChannexProperties props) {
        this.feedService = feedService;
        this.props = props;
    }

    @Scheduled(
        fixedRateString = "#{${clenzy.channex.booking-feed-interval-minutes:10} * 60000}",
        initialDelayString = "#{2 * 60000}")
    @SchedulerLock(name = "channex-booking-feed-poll", lockAtMostFor = "PT10M")
    public void pollFeed() {
        if (!props.isConfigured()) {
            return; // Channex non configure (pas d'API key) : rien a rattraper
        }
        try {
            var result = feedService.processFeed();
            if (result.processed() > 0) {
                log.info("ChannexFeedScheduler: rattrapage — {} traitees, {} ackees, {} en echec",
                    result.processed(), result.acked(), result.failed());
            }
        } catch (Exception e) {
            // Erreur inattendue : loggee, le prochain tick re-tentera (le feed
            // conserve tout ce qui n'est pas acke — aucune perte).
            log.error("ChannexFeedScheduler: passage en echec: {}", e.getMessage());
        }
    }
}
