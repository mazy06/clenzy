package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

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
 *
 * PAS de @SchedulerLock (choix delibere — mise en place ShedLock 2026-07-21) :
 * le relay est at-least-once par design et les consumers Kafka sont idempotents.
 * En multi-instance, un double envoi ponctuel est absorbe cote consumers, alors
 * qu'un verrou serialiserait inutilement le drainage de l'outbox (le claim des
 * events PENDING est deja un UPDATE conditionnel par lot).
 */
@Service
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);
    private static final int MAX_RETRIES = 5;
    /**
     * Taille max d'un lot par tick. Borne la memoire et la duree de la
     * transaction pendant un backlog (panne Kafka) ; le tick suivant (2 s)
     * reprend la suite en FIFO.
     */
    private static final int BATCH_SIZE = 500;

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final SyncMetrics syncMetrics;

    public OutboxRelay(OutboxEventRepository outboxEventRepository,
                       KafkaTemplate<String, Object> kafkaTemplate,
                       ObjectMapper objectMapper,
                       SyncMetrics syncMetrics) {
        this.outboxEventRepository = outboxEventRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.syncMetrics = syncMetrics;
    }

    /**
     * Poll toutes les 2 secondes les events PENDING et les publie sur Kafka.
     *
     * <p>Volontairement SANS {@code @Transactional} (regle audit n°2 : pas
     * d'I/O externe dans une transaction DB) : la lecture est autonome, les
     * envois Kafka sont pipelines hors transaction, et chaque mise a jour de
     * statut est une transaction courte portee par le repository.</p>
     */
    @Scheduled(fixedDelay = 2000)
    public void relayPendingEvents() {
        // Gauge alimentee par un COUNT (index partiel PENDING) : le lot etant
        // borne, sa taille ne reflete plus le backlog reel.
        syncMetrics.updateOutboxPending((int) Math.min(
                outboxEventRepository.countByStatusStr("PENDING"), Integer.MAX_VALUE));

        List<OutboxEvent> pendingEvents =
                outboxEventRepository.findPendingEvents(PageRequest.of(0, BATCH_SIZE));
        if (pendingEvents.isEmpty()) return;

        log.debug("OutboxRelay: {} event(s) PENDING a relayer", pendingEvents.size());

        sendPipelined(pendingEvents);
    }

    /**
     * Reessaye les events FAILED toutes les 30 secondes.
     */
    @Scheduled(fixedDelay = 30000)
    public void retryFailedEvents() {
        List<OutboxEvent> failedEvents =
                outboxEventRepository.findRetryableEvents(MAX_RETRIES, PageRequest.of(0, BATCH_SIZE));
        if (failedEvents.isEmpty()) return;

        log.info("OutboxRelay: {} event(s) FAILED a reessayer", failedEvents.size());

        sendPipelined(failedEvents);
    }

    /**
     * Publie le lot en pipeline : tous les send() partent sans attendre
     * (l'ordre d'emission par cle de partition est preserve — le producer
     * idempotent garantit l'ordre intra-partition), puis on attend l'ensemble
     * des acks. Debit : ~1 RTT broker par LOT au lieu d'un par event.
     */
    private void sendPipelined(List<OutboxEvent> events) {
        List<CompletableFuture<?>> inFlight = new ArrayList<>(events.size());
        for (OutboxEvent event : events) {
            inFlight.add(sendEvent(event));
        }
        try {
            CompletableFuture.allOf(inFlight.toArray(CompletableFuture[]::new)).join();
        } catch (CompletionException e) {
            // Les echecs individuels sont deja traites (markAsFailed) dans le
            // callback de chaque envoi — rien a propager ici.
            log.debug("OutboxRelay: lot termine avec au moins un echec ({})", e.getMessage());
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
     * Envoie un event sur Kafka (non bloquant) et met a jour son statut a la
     * confirmation du broker. Le markAsSent/markAsFailed s'execute dans le
     * callback (thread producer) — chaque mise a jour est une transaction
     * courte portee par le repository, plus aucune connexion DB n'est tenue
     * pendant l'I/O Kafka.
     *
     * IMPORTANT : le payload est stocke comme String JSON dans l'outbox.
     * On le parse en Object avant envoi pour eviter la double-serialisation
     * par le JsonSerializer du KafkaTemplate (qui envelopperait le String
     * dans des guillemets supplementaires).
     */
    private CompletableFuture<?> sendEvent(OutboxEvent event) {
        Timer.Sample sample = syncMetrics.startTimer();

        // Parse le payload JSON String en Object (Map/List) pour eviter
        // la double-serialisation par JsonSerializer
        Object payloadObj;
        try {
            payloadObj = objectMapper.readValue(event.getPayload(), Object.class);
        } catch (Exception e) {
            // Fallback : envoyer le String brut si le parse echoue
            log.warn("OutboxRelay: payload non-JSON pour event {}, envoi brut", event.getId());
            payloadObj = event.getPayload();
        }

        return kafkaTemplate.send(event.getTopic(), event.getPartitionKey(), payloadObj)
                .handle((result, ex) -> {
                    if (ex == null) {
                        sample.stop(Timer.builder("pms.outbox.relay.latency")
                                .description("Outbox event relay latency to Kafka")
                                .register(syncMetrics.getRegistry()));

                        outboxEventRepository.markAsSent(event.getId(), LocalDateTime.now());
                        log.debug("OutboxRelay: event {} envoye sur topic {} (key={})",
                                event.getId(), event.getTopic(), event.getPartitionKey());
                    } else {
                        sample.stop(Timer.builder("pms.outbox.relay.latency")
                                .tag("result", "error")
                                .description("Outbox event relay latency to Kafka")
                                .register(syncMetrics.getRegistry()));

                        Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                        String errorMsg = cause.getMessage() != null
                                ? cause.getMessage() : cause.getClass().getSimpleName();
                        if (errorMsg.length() > 500) errorMsg = errorMsg.substring(0, 500);

                        outboxEventRepository.markAsFailed(event.getId(), errorMsg);
                        log.error("OutboxRelay: echec envoi event {} sur topic {} : {}",
                                event.getId(), event.getTopic(), errorMsg);
                    }
                    return null;
                });
    }
}
