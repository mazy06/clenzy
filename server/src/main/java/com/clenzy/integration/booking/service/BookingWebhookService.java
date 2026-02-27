package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingWebhookPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;

/**
 * Service de traitement des webhooks Booking.com.
 *
 * Flow :
 * 1. Validation de la signature HMAC
 * 2. Parsing du payload
 * 3. Publication dans le topic Kafka correspondant
 * 4. Reponse 200 OK immediate (traitement asynchrone via Kafka consumers)
 *
 * Les topics Kafka utilises :
 * - booking.calendar.sync   : evenements calendrier (availability, rates, restrictions)
 * - booking.reservations    : evenements reservation (created, modified, cancelled)
 */
@Service
public class BookingWebhookService {

    private static final Logger log = LoggerFactory.getLogger(BookingWebhookService.class);

    private static final String TOPIC_BOOKING_CALENDAR = "booking.calendar.sync";
    private static final String TOPIC_BOOKING_RESERVATIONS = "booking.reservations";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final BookingConfig config;
    private final ObjectMapper objectMapper;

    public BookingWebhookService(KafkaTemplate<String, Object> kafkaTemplate,
                                 BookingConfig config,
                                 ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.config = config;
        this.objectMapper = objectMapper;
    }

    /**
     * Valide la signature HMAC-SHA256 du webhook.
     *
     * @param signature la signature recue dans le header
     * @param payload   le body brut du webhook
     * @return true si la signature est valide
     */
    public boolean validateWebhookSignature(String signature, String payload) {
        if (config.getWebhookSecret() == null || config.getWebhookSecret().isEmpty()) {
            log.error("BOOKING_WEBHOOK_SECRET non configure — webhook rejete par securite");
            return false;
        }

        if (signature == null || signature.isEmpty()) {
            log.warn("Signature webhook Booking.com absente");
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
            log.error("Erreur validation signature webhook Booking.com: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Traite un webhook Booking.com et publie dans le topic Kafka correspondant.
     *
     * @param payload le payload du webhook
     * @param orgId   l'organisation cible (resolue par le controller via hotelId)
     */
    public void processWebhook(BookingWebhookPayload payload, Long orgId) {
        String eventType = payload.eventType();
        String hotelId = payload.hotelId();

        log.info("Webhook Booking.com recu: type={}, hotel={}, reservation={}",
                eventType, hotelId, payload.reservationId());

        String topic = resolveKafkaTopic(eventType);

        // Construire l'evenement Kafka avec les metadonnees necessaires
        Map<String, Object> kafkaEvent = Map.of(
                "event_type", eventType != null ? eventType : "",
                "hotel_id", hotelId != null ? hotelId : "",
                "reservation_id", payload.reservationId() != null ? payload.reservationId() : "",
                "data", payload.data() != null ? payload.data() : Map.of(),
                "timestamp", payload.timestamp() != null ? payload.timestamp() : "",
                "org_id", orgId != null ? orgId : 0
        );

        String key = payload.reservationId() != null ? payload.reservationId() : hotelId;

        kafkaTemplate.send(topic, key, kafkaEvent)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Erreur publication Kafka pour webhook Booking.com (type={}, hotel={}): {}",
                                eventType, hotelId, ex.getMessage());
                    } else {
                        log.debug("Webhook Booking.com publie dans topic {}: type={}", topic, eventType);
                    }
                });
    }

    /**
     * Determine le topic Kafka en fonction du type d'evenement.
     */
    private String resolveKafkaTopic(String eventType) {
        if (eventType == null) {
            return TOPIC_BOOKING_RESERVATIONS;
        }

        if (eventType.startsWith("reservation.")) {
            return TOPIC_BOOKING_RESERVATIONS;
        } else if (eventType.startsWith("availability.")
                || eventType.startsWith("rates.")
                || eventType.startsWith("restrictions.")) {
            return TOPIC_BOOKING_CALENDAR;
        }

        log.warn("Type d'evenement Booking.com inconnu: {}, envoi dans topic reservations", eventType);
        return TOPIC_BOOKING_RESERVATIONS;
    }
}
