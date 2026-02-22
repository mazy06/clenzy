package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Relay asynchrone qui poll les events PENDING dans la table outbox_events
 * et les publie sur Kafka.
 *
 * Garanties :
 * - At-least-once delivery : un event peut etre envoye plusieurs fois en cas de crash
 * - FIFO par partition : la cle de partitionnement (propertyId) garantit l'ordre
 * - Retry automatique : les events FAILED sont reessayes jusqu'a MAX_RETRIES
 * - Nettoyage : les events SENT > 7 jours sont supprimes periodiquement
 *
 * Le relay tourne toutes les 2 secondes et traite les events par batch.
 */
@Service
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);
    private static final int MAX_RETRIES = 5;

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final SyncMetrics syncMetrics;

    public OutboxRelay(OutboxEventRepository outboxEventRepository,
                       KafkaTemplate<String, Object> kafkaTemplate,
                       SyncMetrics syncMetrics) {
        this.outboxEventRepository = outboxEventRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.syncMetrics = syncMetrics;
    }

    /**
     * Poll toutes les 2 secondes les events PENDING et les publie sur Kafka.
     */
    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEvent> pendingEvents = outboxEventRepository.findPendingEvents();
        syncMetrics.updateOutboxPending(pendingEvents.size());
        if (pendingEvents.isEmpty()) return;

        log.debug("OutboxRelay: {} event(s) PENDING a relayer", pendingEvents.size());

        for (OutboxEvent event : pendingEvents) {
            sendEvent(event);
        }
    }

    /**
     * Reessaye les events FAILED toutes les 30 secondes.
     */
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryFailedEvents() {
        List<OutboxEvent> failedEvents = outboxEventRepository.findRetryableEvents(MAX_RETRIES);
        if (failedEvents.isEmpty()) return;

        log.info("OutboxRelay: {} event(s) FAILED a reessayer", failedEvents.size());

        for (OutboxEvent event : failedEvents) {
            sendEvent(event);
        }
    }

    /**
     * Nettoyage des events SENT > 7 jours, toutes les heures.
     */
    @Scheduled(fixedDelay = 3600000)
    @Transactional
    public void cleanupSentEvents() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(7);
        int deleted = outboxEventRepository.deleteSentBefore(threshold);
        if (deleted > 0) {
            log.info("OutboxRelay: {} event(s) SENT nettoye(s) (> 7 jours)", deleted);
        }
    }

    /**
     * Envoie un event sur Kafka et met a jour son statut.
     */
    private void sendEvent(OutboxEvent event) {
        Timer.Sample sample = syncMetrics.startTimer();
        try {
            kafkaTemplate.send(
                    event.getTopic(),
                    event.getPartitionKey(),
                    event.getPayload()
            ).get(); // Bloquant : on attend la confirmation du broker

            sample.stop(Timer.builder("pms.outbox.relay.latency")
                    .description("Outbox event relay latency to Kafka")
                    .register(syncMetrics.getRegistry()));

            outboxEventRepository.markAsSent(event.getId(), LocalDateTime.now());
            log.debug("OutboxRelay: event {} envoye sur topic {} (key={})",
                    event.getId(), event.getTopic(), event.getPartitionKey());

        } catch (Exception e) {
            sample.stop(Timer.builder("pms.outbox.relay.latency")
                    .tag("result", "error")
                    .description("Outbox event relay latency to Kafka")
                    .register(syncMetrics.getRegistry()));

            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (errorMsg.length() > 500) errorMsg = errorMsg.substring(0, 500);

            outboxEventRepository.markAsFailed(event.getId(), errorMsg);
            log.error("OutboxRelay: echec envoi event {} sur topic {} : {}",
                    event.getId(), event.getTopic(), errorMsg);
        }
    }
}
