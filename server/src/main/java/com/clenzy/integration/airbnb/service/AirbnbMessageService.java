package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Service de gestion des messages Airbnb.
 *
 * Ecoute le topic Kafka airbnb.messages.sync pour :
 * - Stocker les messages recus des guests
 * - Permettre la reponse via l'API Airbnb
 */
@Service
public class AirbnbMessageService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbMessageService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;

    public AirbnbMessageService(AirbnbListingMappingRepository listingMappingRepository,
                                AirbnbWebhookService webhookService,
                                AuditLogService auditLogService) {
        this.listingMappingRepository = listingMappingRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements message Airbnb.
     */
    @KafkaListener(topics = KafkaConfig.TOPIC_AIRBNB_MESSAGES, groupId = "clenzy-messages")
    public void handleMessageEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement message Airbnb: {} ({})", eventType, eventId);

        try {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            switch (eventType) {
                case "message.received":
                    handleMessageReceived(data);
                    break;
                case "message.sent":
                    handleMessageSent(data);
                    break;
                default:
                    log.warn("Type d'evenement message inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (Exception e) {
            log.error("Erreur traitement message Airbnb {}: {}", eventId, e.getMessage());
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    private void handleMessageReceived(Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        String senderName = (String) data.get("sender_name");
        String content = (String) data.get("content");

        log.info("Message Airbnb recu de {} pour reservation {}: {}",
                senderName, reservationId, content != null && content.length() > 50 ? content.substring(0, 50) + "..." : content);

        // TODO : Stocker le message dans une table dediee
        // TODO : Envoyer une notification push/email au proprietaire
        // TODO : Integrer avec le systeme de notifications Clenzy

        auditLogService.logSync("AirbnbMessage", reservationId,
                "Message Airbnb recu de " + senderName);
    }

    private void handleMessageSent(Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        log.info("Confirmation envoi message Airbnb pour reservation {}", reservationId);
    }
}
