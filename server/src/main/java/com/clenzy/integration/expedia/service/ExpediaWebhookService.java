package com.clenzy.integration.expedia.service;

import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service de traitement des webhooks Expedia/VRBO.
 *
 * Flow :
 * 1. Validation de la signature HMAC
 * 2. Deduplication via eventId (in-memory + idempotence Kafka)
 * 3. Publication dans le topic Kafka correspondant
 * 4. Reponse 200 OK immediate (traitement asynchrone)
 *
 * Note : contrairement a Airbnb, Expedia n'a pas de table webhook_events
 * dediee pour l'instant. La deduplication se fait en memoire
 * (suffisant pour un deployment single-node, a migrer vers Redis si multi-node).
 */
@Service
public class ExpediaWebhookService {

    private static final Logger log = LoggerFactory.getLogger(ExpediaWebhookService.class);

    private static final String TOPIC_EXPEDIA_RESERVATIONS = "expedia.reservations.sync";
    private static final String TOPIC_EXPEDIA_CALENDAR = "expedia.calendar.sync";
    private static final String TOPIC_EXPEDIA_DLQ = "expedia.dlq";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ExpediaConfig config;
    private final ObjectMapper objectMapper;

    /**
     * Cache de deduplication in-memory (eventId -> timestamp).
     * Les entrees expirent naturellement via cleanup periodique.
     */
    private final ConcurrentHashMap<String, LocalDateTime> processedEvents = new ConcurrentHashMap<>();

    public ExpediaWebhookService(KafkaTemplate<String, Object> kafkaTemplate,
                                 ExpediaConfig config,
                                 ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.config = config;
        this.objectMapper = objectMapper;
    }

    /**
     * Traite un evenement webhook entrant d'Expedia.
     *
     * @param payload   le body JSON brut
     * @param signature la signature HMAC de l'en-tete
     * @return true si l'evenement a ete accepte
     */
    public boolean processWebhook(String payload, String signature) {
        try {
            // 1. Valider la signature
            if (config.getWebhookSecret() == null || config.getWebhookSecret().isEmpty()) {
                log.error("EXPEDIA_WEBHOOK_SECRET non configure — webhook rejete par securite");
                return false;
            }
            if (!validateSignature(payload, signature)) {
                log.warn("Signature webhook Expedia invalide");
                return false;
            }

            // 2. Parser le payload
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);
            String eventId = (String) data.get("event_id");
            String eventType = (String) data.get("event_type");

            if (eventId == null || eventType == null) {
                log.warn("Webhook Expedia sans event_id ou event_type");
                return false;
            }

            // 3. Deduplication
            if (processedEvents.containsKey(eventId)) {
                log.info("Webhook Expedia duplique ignore: {} ({})", eventId, eventType);
                return true;
            }

            // 4. Publier dans le topic Kafka correspondant
            String topic = resolveKafkaTopic(eventType);
            kafkaTemplate.send(topic, eventId, data)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Erreur publication Kafka pour webhook Expedia {}: {}",
                                    eventId, ex.getMessage());
                        } else {
                            log.debug("Webhook Expedia {} publie dans topic {}", eventId, topic);
                            processedEvents.put(eventId, LocalDateTime.now());
                        }
                    });

            log.info("Webhook Expedia recu et publie: {} ({})", eventId, eventType);
            return true;

        } catch (Exception e) {
            log.error("Erreur traitement webhook Expedia: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Valide la signature HMAC-SHA256 du webhook Expedia.
     */
    private boolean validateSignature(String payload, String signature) {
        if (signature == null || signature.isEmpty()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = HexFormat.of().formatHex(hash);

            // Constant-time comparison to prevent timing attacks
            return java.security.MessageDigest.isEqual(
                    expectedSignature.toLowerCase().getBytes(StandardCharsets.UTF_8),
                    signature.toLowerCase().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Erreur validation signature webhook Expedia: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Determine le topic Kafka en fonction du type d'evenement.
     */
    private String resolveKafkaTopic(String eventType) {
        if (eventType == null) {
            return TOPIC_EXPEDIA_DLQ;
        }

        if (eventType.startsWith("reservation.")) {
            return TOPIC_EXPEDIA_RESERVATIONS;
        } else if (eventType.startsWith("availability.") || eventType.startsWith("rate.")) {
            return TOPIC_EXPEDIA_CALENDAR;
        } else {
            log.warn("Type d'evenement Expedia inconnu: {}, envoi en DLQ", eventType);
            return TOPIC_EXPEDIA_DLQ;
        }
    }

    /**
     * Marque un evenement comme traite.
     */
    public void markAsProcessed(String eventId) {
        if (eventId != null) {
            processedEvents.put(eventId, LocalDateTime.now());
            log.debug("Webhook Expedia {} marque comme traite", eventId);
        }
    }

    /**
     * Marque un evenement comme echoue.
     */
    public void markAsFailed(String eventId, String errorMessage) {
        log.warn("Webhook Expedia {} en echec: {}", eventId, errorMessage);
        // L'evenement reste dans processedEvents pour eviter le re-processing
        // En cas de retry, Expedia renverra avec un nouvel event_id
    }

    /**
     * Nettoyage periodique du cache de deduplication.
     * Supprime les entrees de plus de 24h.
     */
    public void cleanupProcessedEvents() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(24);
        processedEvents.entrySet().removeIf(entry -> entry.getValue().isBefore(threshold));
        log.debug("Cleanup cache deduplication Expedia: {} entrees restantes",
                processedEvents.size());
    }
}
