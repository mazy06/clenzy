package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbWebhookEvent;
import com.clenzy.integration.airbnb.repository.AirbnbWebhookEventRepository;
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

/**
 * Service de traitement des webhooks Airbnb.
 *
 * Flow :
 * 1. Validation de la signature HMAC
 * 2. Deduplication via eventId
 * 3. Stockage brut en base (audit trail)
 * 4. Publication dans le topic Kafka correspondant
 * 5. Reponse 200 OK immediate (traitement asynchrone)
 */
@Service
public class AirbnbWebhookService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbWebhookService.class);

    private final AirbnbWebhookEventRepository webhookEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final AirbnbConfig config;
    private final ObjectMapper objectMapper;

    public AirbnbWebhookService(AirbnbWebhookEventRepository webhookEventRepository,
                                KafkaTemplate<String, Object> kafkaTemplate,
                                AirbnbConfig config,
                                ObjectMapper objectMapper) {
        this.webhookEventRepository = webhookEventRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.config = config;
        this.objectMapper = objectMapper;
    }

    /**
     * Traite un evenement webhook entrant.
     *
     * @param payload   le body JSON brut
     * @param signature la signature HMAC de l'en-tete
     * @return true si l'evenement a ete accepte
     */
    public boolean processWebhook(String payload, String signature) {
        try {
            // 1. Valider la signature — OBLIGATOIRE
            if (config.getWebhookSecret() == null || config.getWebhookSecret().isEmpty()) {
                log.error("AIRBNB_WEBHOOK_SECRET non configure — webhook rejete par securite");
                return false;
            }
            if (!validateSignature(payload, signature)) {
                log.warn("Signature webhook Airbnb invalide");
                return false;
            }

            // 2. Parser le payload
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);
            String eventId = (String) data.get("event_id");
            String eventType = (String) data.get("event_type");

            if (eventId == null || eventType == null) {
                log.warn("Webhook Airbnb sans event_id ou event_type");
                return false;
            }

            // 3. Deduplication
            if (webhookEventRepository.findByEventId(eventId).isPresent()) {
                log.info("Webhook Airbnb duplique ignore: {} ({})", eventId, eventType);
                return true; // Deja traite, retourner 200 quand meme
            }

            // 4. Stocker l'evenement brut en base
            AirbnbWebhookEvent event = new AirbnbWebhookEvent();
            event.setEventId(eventId);
            event.setEventType(eventType);
            event.setPayload(payload);
            event.setSignature(signature);
            event.setStatus(AirbnbWebhookEvent.WebhookEventStatus.PENDING);
            event.setReceivedAt(LocalDateTime.now());

            webhookEventRepository.save(event);

            // 5. Publier dans le topic Kafka correspondant
            String topic = resolveKafkaTopic(eventType);
            kafkaTemplate.send(topic, eventId, data)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Erreur publication Kafka pour webhook {}: {}", eventId, ex.getMessage());
                            event.setStatus(AirbnbWebhookEvent.WebhookEventStatus.FAILED);
                            event.setErrorMessage("Kafka publish failed: " + ex.getMessage());
                            webhookEventRepository.save(event);
                        } else {
                            log.debug("Webhook {} publie dans topic {}", eventId, topic);
                        }
                    });

            log.info("Webhook Airbnb recu et publie: {} ({})", eventId, eventType);
            return true;

        } catch (Exception e) {
            log.error("Erreur traitement webhook Airbnb: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Valide la signature HMAC-SHA256 du webhook.
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
            log.error("Erreur validation signature webhook: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Determine le topic Kafka en fonction du type d'evenement.
     */
    private String resolveKafkaTopic(String eventType) {
        if (eventType == null) {
            return KafkaConfig.TOPIC_DLQ;
        }

        if (eventType.startsWith("reservation.")) {
            return KafkaConfig.TOPIC_AIRBNB_RESERVATIONS;
        } else if (eventType.startsWith("calendar.")) {
            return KafkaConfig.TOPIC_AIRBNB_CALENDAR;
        } else if (eventType.startsWith("message.")) {
            return KafkaConfig.TOPIC_AIRBNB_MESSAGES;
        } else if (eventType.startsWith("listing.")) {
            return KafkaConfig.TOPIC_AIRBNB_LISTINGS;
        } else {
            log.warn("Type d'evenement Airbnb inconnu: {}, envoi en DLQ", eventType);
            return KafkaConfig.TOPIC_DLQ;
        }
    }

    /**
     * Marque un evenement comme traite.
     */
    public void markAsProcessed(String eventId) {
        webhookEventRepository.findByEventId(eventId).ifPresent(event -> {
            event.setStatus(AirbnbWebhookEvent.WebhookEventStatus.PROCESSED);
            event.setProcessedAt(LocalDateTime.now());
            webhookEventRepository.save(event);
        });
    }

    /**
     * Marque un evenement comme echoue.
     */
    public void markAsFailed(String eventId, String errorMessage) {
        webhookEventRepository.findByEventId(eventId).ifPresent(event -> {
            event.setStatus(AirbnbWebhookEvent.WebhookEventStatus.FAILED);
            event.setErrorMessage(errorMessage);
            event.setRetryCount(event.getRetryCount() + 1);
            webhookEventRepository.save(event);
        });
    }
}
