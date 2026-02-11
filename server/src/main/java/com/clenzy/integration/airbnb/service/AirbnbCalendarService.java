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
 * Service de synchronisation du calendrier Airbnb.
 *
 * Ecoute le topic Kafka airbnb.calendar.sync pour :
 * - Mettre a jour les disponibilites des proprietes
 * - Synchroniser les prix par nuit
 * - Gerer les blocages manuels de dates
 */
@Service
public class AirbnbCalendarService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbCalendarService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;

    public AirbnbCalendarService(AirbnbListingMappingRepository listingMappingRepository,
                                 AirbnbWebhookService webhookService,
                                 AuditLogService auditLogService) {
        this.listingMappingRepository = listingMappingRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements calendrier Airbnb.
     */
    @KafkaListener(topics = KafkaConfig.TOPIC_AIRBNB_CALENDAR, groupId = "clenzy-calendar")
    public void handleCalendarEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement calendrier Airbnb: {} ({})", eventType, eventId);

        try {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            String airbnbListingId = (String) data.get("listing_id");
            Optional<AirbnbListingMapping> mappingOpt = listingMappingRepository.findByAirbnbListingId(airbnbListingId);

            if (mappingOpt.isEmpty()) {
                log.warn("Listing Airbnb {} non liee, evenement calendrier ignore", airbnbListingId);
                webhookService.markAsProcessed(eventId);
                return;
            }

            AirbnbListingMapping mapping = mappingOpt.get();

            switch (eventType) {
                case "calendar.updated":
                    handleCalendarUpdated(mapping, data);
                    break;
                case "calendar.blocked":
                    handleCalendarBlocked(mapping, data);
                    break;
                case "calendar.unblocked":
                    handleCalendarUnblocked(mapping, data);
                    break;
                default:
                    log.warn("Type d'evenement calendrier inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (Exception e) {
            log.error("Erreur traitement calendrier Airbnb {}: {}", eventId, e.getMessage());
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    private void handleCalendarUpdated(AirbnbListingMapping mapping, Map<String, Object> data) {
        // TODO : Mettre a jour les disponibilites dans le calendrier Clenzy
        // Pour l'instant, on log l'evenement
        log.info("Calendrier mis a jour pour propriete {} (listing {})",
                mapping.getPropertyId(), mapping.getAirbnbListingId());

        auditLogService.logSync("AirbnbCalendar", mapping.getAirbnbListingId(),
                "Calendrier Airbnb synchronise pour propriete " + mapping.getPropertyId());
    }

    private void handleCalendarBlocked(AirbnbListingMapping mapping, Map<String, Object> data) {
        // TODO : Bloquer les dates dans le planning Clenzy
        log.info("Dates bloquees pour propriete {} (listing {})",
                mapping.getPropertyId(), mapping.getAirbnbListingId());
    }

    private void handleCalendarUnblocked(AirbnbListingMapping mapping, Map<String, Object> data) {
        // TODO : Debloquer les dates dans le planning Clenzy
        log.info("Dates debloquees pour propriete {} (listing {})",
                mapping.getPropertyId(), mapping.getAirbnbListingId());
    }
}
