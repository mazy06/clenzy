package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.CalendarEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Service de synchronisation du calendrier Airbnb.
 *
 * Ecoute le topic Kafka airbnb.calendar.sync pour :
 * - Mettre a jour les disponibilites des proprietes (prix par nuit)
 * - Gerer les blocages manuels de dates
 * - Gerer les deblocages de dates
 *
 * Delegue les mutations calendrier au CalendarEngine qui gere
 * les advisory locks et l'anti-double-booking.
 *
 * orgId est resolu via AirbnbListingMapping (pas de TenantContext
 * car les Kafka consumers s'executent hors contexte HTTP).
 */
@Service
public class AirbnbCalendarService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbCalendarService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;
    private final CalendarEngine calendarEngine;

    public AirbnbCalendarService(AirbnbListingMappingRepository listingMappingRepository,
                                 AirbnbWebhookService webhookService,
                                 AuditLogService auditLogService,
                                 CalendarEngine calendarEngine) {
        this.listingMappingRepository = listingMappingRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
        this.calendarEngine = calendarEngine;
    }

    /**
     * Consumer Kafka pour les evenements calendrier Airbnb.
     *
     * @Transactional ici car les methodes privees appelees en interne
     * ne peuvent pas etre interceptees par Spring AOP (proxy-based).
     * CalendarEngine est deja @Transactional, mais on enveloppe tout
     * le traitement pour que les appels auditLogService + webhookService
     * partagent la meme transaction.
     */
    @Transactional
    @KafkaListener(topics = KafkaConfig.TOPIC_AIRBNB_CALENDAR, groupId = "clenzy-calendar")
    public void handleCalendarEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement calendrier Airbnb: {} ({})", eventType, eventId);

        try {
            @SuppressWarnings("unchecked")
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
            log.error("Erreur traitement calendrier Airbnb {}: {}", eventId, e.getMessage(), e);
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    /**
     * Met a jour les prix par nuit dans le calendrier Clenzy.
     * Appele sur un evenement "calendar.updated" d'Airbnb.
     */
    private void handleCalendarUpdated(AirbnbListingMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleCalendarUpdated: dates manquantes pour listing {}", mapping.getAirbnbListingId());
            auditLogService.logSync("AirbnbCalendar", mapping.getAirbnbListingId(),
                    "Calendrier Airbnb synchronise pour propriete " + mapping.getPropertyId() + " (dates manquantes, prix non mis a jour)");
            return;
        }

        BigDecimal nightlyPrice = parsePriceField(data, "nightly_price");

        if (nightlyPrice != null) {
            try {
                calendarEngine.updatePrice(
                        mapping.getPropertyId(),
                        startDate,
                        endDate,
                        nightlyPrice,
                        mapping.getOrganizationId(),
                        "airbnb-webhook"
                );
                log.info("Prix mis a jour pour propriete {} (listing {}) : {} [{}, {})",
                        mapping.getPropertyId(), mapping.getAirbnbListingId(), nightlyPrice, startDate, endDate);
            } catch (CalendarLockException e) {
                log.warn("Lock calendrier non disponible pour propriete {} — reessayer", mapping.getPropertyId());
                throw e; // Kafka renverra le message
            }
        }

        auditLogService.logSync("AirbnbCalendar", mapping.getAirbnbListingId(),
                "Calendrier Airbnb synchronise pour propriete " + mapping.getPropertyId());
    }

    /**
     * Bloque des dates dans le calendrier Clenzy.
     * Appele sur un evenement "calendar.blocked" d'Airbnb.
     */
    private void handleCalendarBlocked(AirbnbListingMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleCalendarBlocked: dates manquantes pour listing {}", mapping.getAirbnbListingId());
            return;
        }

        try {
            calendarEngine.block(
                    mapping.getPropertyId(),
                    startDate,
                    endDate,
                    mapping.getOrganizationId(),
                    "AIRBNB",
                    "Bloque via Airbnb (listing " + mapping.getAirbnbListingId() + ")",
                    "airbnb-webhook"
            );
            log.info("Dates bloquees pour propriete {} (listing {}) [{}, {})",
                    mapping.getPropertyId(), mapping.getAirbnbListingId(), startDate, endDate);
        } catch (CalendarConflictException e) {
            log.warn("Conflit calendrier lors du blocage Airbnb pour propriete {} [{}, {}) : {}",
                    mapping.getPropertyId(), startDate, endDate, e.getMessage());
            // Ne pas throw : les jours sont deja reserves, on log et continue
        } catch (CalendarLockException e) {
            log.warn("Lock calendrier non disponible pour propriete {} — reessayer", mapping.getPropertyId());
            throw e; // Kafka renverra le message
        }
    }

    /**
     * Debloque des dates dans le calendrier Clenzy.
     * Appele sur un evenement "calendar.unblocked" d'Airbnb.
     */
    private void handleCalendarUnblocked(AirbnbListingMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleCalendarUnblocked: dates manquantes pour listing {}", mapping.getAirbnbListingId());
            return;
        }

        try {
            calendarEngine.unblock(
                    mapping.getPropertyId(),
                    startDate,
                    endDate,
                    mapping.getOrganizationId(),
                    "airbnb-webhook"
            );
            log.info("Dates debloquees pour propriete {} (listing {}) [{}, {})",
                    mapping.getPropertyId(), mapping.getAirbnbListingId(), startDate, endDate);
        } catch (CalendarLockException e) {
            log.warn("Lock calendrier non disponible pour propriete {} — reessayer", mapping.getPropertyId());
            throw e; // Kafka renverra le message
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Parse un champ date depuis le data Map Airbnb.
     * Supporte les formats ISO (yyyy-MM-dd).
     */
    private LocalDate parseDateField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            return LocalDate.parse(value.toString());
        } catch (DateTimeParseException e) {
            log.warn("Format de date invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }

    /**
     * Parse un champ prix depuis le data Map Airbnb.
     */
    private BigDecimal parsePriceField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Format de prix invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }
}
