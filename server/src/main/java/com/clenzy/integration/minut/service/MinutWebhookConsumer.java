package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

/**
 * Durable Baitly intake before acknowledging Kafka.
 * Parsing/storage failures reach Kafka recovery; after admission the journal owns progress.
 */
@Service
public class MinutWebhookConsumer {
    private static final Logger log=LoggerFactory.getLogger(MinutWebhookConsumer.class);
    private final BaitlyMinutEventParser parser;
    private final BaitlyMinutEventJournal journal;
    private final BaitlyMinutRecoveryWorker worker;

    public MinutWebhookConsumer(BaitlyMinutEventParser parser, BaitlyMinutEventJournal journal, BaitlyMinutRecoveryWorker worker) {
        this.parser=parser; this.journal=journal; this.worker=worker;
    }

    @KafkaListener(topics=KafkaConfig.TOPIC_MINUT_WEBHOOKS,groupId="clenzy-minut-noise")
    public void handleMinutWebhook(String payload) {
        try {
            var event=parser.parse(payload);
            if (event.isEmpty()) {
                log.debug("Webhook Minut ignore : type ou mesure non pris en charge");
                return;
            }
            var id=journal.admit(event.get());
            worker.process(id);
        } catch (RuntimeException failure) {
            log.error("Reception durable Minut non confirmee");
            // No payload, provider diagnostics, cause or suppressed exceptions in Kafka errors.
            throw BaitlyMinutEventParser.unavailable();
        }
    }
}
