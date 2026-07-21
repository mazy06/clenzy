package com.clenzy.scheduler;

import com.clenzy.model.WebhookDelivery;
import com.clenzy.repository.WebhookDeliveryRepository;
import com.clenzy.service.WebhookDeliveryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.List;

/**
 * Reessaie les livraisons de webhooks dues (PENDING/RETRYING avec {@code next_attempt_at} echu),
 * cross-org (CLZ Domaine 10). La tentative effectue l'appel HTTP hors transaction et gere le
 * backoff/desactivation cote {@link WebhookDeliveryService}.
 */
@Component
public class WebhookRetryScheduler {

    private static final Logger log = LoggerFactory.getLogger(WebhookRetryScheduler.class);
    private static final int BATCH = 100;

    private final WebhookDeliveryRepository deliveryRepository;
    private final WebhookDeliveryService deliveryService;
    private final Clock clock;

    public WebhookRetryScheduler(WebhookDeliveryRepository deliveryRepository,
                                 WebhookDeliveryService deliveryService,
                                 Clock clock) {
        this.deliveryRepository = deliveryRepository;
        this.deliveryService = deliveryService;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clenzy.webhooks.retry-interval-ms:60000}")
    @SchedulerLock(name = "webhook-retry", lockAtMostFor = "PT5M", lockAtLeastFor = "PT30S")
    public void retryDueDeliveries() {
        List<WebhookDelivery> due = deliveryRepository.findDue(clock.instant(), PageRequest.of(0, BATCH));
        if (due.isEmpty()) {
            return;
        }
        log.debug("Retry de {} livraison(s) webhook due(s)", due.size());
        for (WebhookDelivery d : due) {
            try {
                deliveryService.attempt(d.getId());
            } catch (Exception e) {
                log.warn("Retry de la livraison webhook {} echoue: {}", d.getId(), e.getMessage());
            }
        }
    }
}
