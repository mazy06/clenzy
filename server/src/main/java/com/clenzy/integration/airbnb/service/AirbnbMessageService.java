package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.messaging.ConversationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service de gestion des messages Airbnb.
 *
 * Ecoute le topic Kafka airbnb.messages.sync pour :
 * - Stocker les messages dans l'inbox unifie via ConversationService
 * - Permettre la reponse via l'API Airbnb
 */
@Service
public class AirbnbMessageService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbMessageService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;
    private final ConversationService conversationService;

    public AirbnbMessageService(AirbnbListingMappingRepository listingMappingRepository,
                                AirbnbWebhookService webhookService,
                                AuditLogService auditLogService,
                                ConversationService conversationService) {
        this.listingMappingRepository = listingMappingRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
        this.conversationService = conversationService;
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
        String threadId = (String) data.get("thread_id");
        String messageId = (String) data.get("message_id");

        log.info("Message Airbnb recu de {} pour reservation {}: {}",
                senderName, reservationId, content != null && content.length() > 50 ? content.substring(0, 50) + "..." : content);

        // Chercher l'organisation via le listing mapping
        Long orgId = resolveOrganizationId(data);
        if (orgId != null) {
            String externalId = threadId != null ? threadId : reservationId;
            Conversation conversation = conversationService.getOrCreate(
                orgId, ConversationChannel.AIRBNB, externalId,
                null, null, null, "Airbnb: " + senderName);

            conversationService.addInboundMessage(
                conversation, senderName, "airbnb:" + reservationId,
                content, null, messageId);
        }

        auditLogService.logSync("AirbnbMessage", reservationId,
                "Message Airbnb recu de " + senderName);
    }

    private void handleMessageSent(Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        log.info("Confirmation envoi message Airbnb pour reservation {}", reservationId);
    }

    private Long resolveOrganizationId(Map<String, Object> data) {
        String listingId = (String) data.get("listing_id");
        if (listingId != null) {
            return listingMappingRepository.findByAirbnbListingId(listingId)
                .map(m -> m.getOrganizationId())
                .orElse(null);
        }
        return null;
    }
}
