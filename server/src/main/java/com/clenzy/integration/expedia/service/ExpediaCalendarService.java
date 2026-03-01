package com.clenzy.integration.expedia.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
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
 * Service de synchronisation du calendrier Expedia/VRBO.
 *
 * Ecoute le topic Kafka expedia.calendar.sync pour :
 * - Mettre a jour les disponibilites des proprietes
 * - Gerer les blocages/deblocages de dates
 * - Mettre a jour les tarifs par nuit
 *
 * Delegue les mutations calendrier au CalendarEngine qui gere
 * les advisory locks et l'anti-double-booking.
 *
 * orgId est resolu via ChannelMapping (pas de TenantContext
 * car les Kafka consumers s'executent hors contexte HTTP).
 */
@Service
public class ExpediaCalendarService {

    private static final Logger log = LoggerFactory.getLogger(ExpediaCalendarService.class);

    private static final String TOPIC_EXPEDIA_CALENDAR = "expedia.calendar.sync";

    private final ChannelMappingRepository channelMappingRepository;
    private final ExpediaWebhookService webhookService;
    private final AuditLogService auditLogService;
    private final CalendarEngine calendarEngine;

    public ExpediaCalendarService(ChannelMappingRepository channelMappingRepository,
                                  ExpediaWebhookService webhookService,
                                  AuditLogService auditLogService,
                                  CalendarEngine calendarEngine) {
        this.channelMappingRepository = channelMappingRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
        this.calendarEngine = calendarEngine;
    }

    /**
     * Consumer Kafka pour les evenements calendrier Expedia.
     *
     * @Transactional car les appels auditLogService + webhookService
     * doivent partager la meme transaction que CalendarEngine.
     */
    @Transactional
    @KafkaListener(topics = TOPIC_EXPEDIA_CALENDAR, groupId = "clenzy-expedia-calendar")
    public void handleCalendarEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement calendrier Expedia: {} ({})", eventType, eventId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            String expediaPropertyId = (String) data.get("property_id");
            Long orgId = parseOrgId(data);

            Optional<ChannelMapping> mappingOpt = findExpediaMapping(expediaPropertyId, orgId);

            if (mappingOpt.isEmpty()) {
                log.warn("Propriete Expedia {} non liee, evenement calendrier ignore",
                        expediaPropertyId);
                webhookService.markAsProcessed(eventId);
                return;
            }

            ChannelMapping mapping = mappingOpt.get();

            switch (eventType) {
                case "availability.updated" -> handleAvailabilityUpdated(mapping, data);
                case "availability.blocked" -> handleAvailabilityBlocked(mapping, data);
                case "availability.unblocked" -> handleAvailabilityUnblocked(mapping, data);
                case "rate.updated" -> handleRateUpdated(mapping, data);
                default -> log.warn("Type d'evenement calendrier Expedia inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (CalendarLockException e) {
            log.warn("Lock calendrier non disponible — Kafka renverra le message: {}", e.getMessage());
            throw e; // Kafka renverra le message
        } catch (Exception e) {
            log.error("Erreur traitement calendrier Expedia {}: {}", eventId, e.getMessage(), e);
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    /**
     * Met a jour les disponibilites dans le calendrier Clenzy.
     */
    private void handleAvailabilityUpdated(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleAvailabilityUpdated: dates manquantes pour propriete Expedia {}",
                    mapping.getExternalId());
            return;
        }

        BigDecimal nightlyPrice = parsePriceField(data, "price_per_night");

        if (nightlyPrice != null) {
            calendarEngine.updatePrice(
                    mapping.getInternalId(),
                    startDate,
                    endDate,
                    nightlyPrice,
                    mapping.getOrganizationId(),
                    "expedia-webhook"
            );
            log.info("Prix mis a jour pour propriete {} (Expedia {}) : {} [{}, {})",
                    mapping.getInternalId(), mapping.getExternalId(),
                    nightlyPrice, startDate, endDate);
        }

        auditLogService.logSync("ExpediaCalendar", mapping.getExternalId(),
                "Calendrier Expedia synchronise pour propriete " + mapping.getInternalId());
    }

    /**
     * Bloque des dates dans le calendrier Clenzy.
     */
    private void handleAvailabilityBlocked(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleAvailabilityBlocked: dates manquantes pour propriete Expedia {}",
                    mapping.getExternalId());
            return;
        }

        try {
            calendarEngine.block(
                    mapping.getInternalId(),
                    startDate,
                    endDate,
                    mapping.getOrganizationId(),
                    "VRBO",
                    "Bloque via Expedia/VRBO (propriete " + mapping.getExternalId() + ")",
                    "expedia-webhook"
            );
            log.info("Dates bloquees pour propriete {} (Expedia {}) [{}, {})",
                    mapping.getInternalId(), mapping.getExternalId(), startDate, endDate);
        } catch (CalendarConflictException e) {
            log.warn("Conflit calendrier lors du blocage Expedia pour propriete {} [{}, {}) : {}",
                    mapping.getInternalId(), startDate, endDate, e.getMessage());
        }
    }

    /**
     * Debloque des dates dans le calendrier Clenzy.
     */
    private void handleAvailabilityUnblocked(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleAvailabilityUnblocked: dates manquantes pour propriete Expedia {}",
                    mapping.getExternalId());
            return;
        }

        calendarEngine.unblock(
                mapping.getInternalId(),
                startDate,
                endDate,
                mapping.getOrganizationId(),
                "expedia-webhook"
        );
        log.info("Dates debloquees pour propriete {} (Expedia {}) [{}, {})",
                mapping.getInternalId(), mapping.getExternalId(), startDate, endDate);
    }

    /**
     * Met a jour les tarifs dans le calendrier Clenzy.
     */
    private void handleRateUpdated(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");
        BigDecimal price = parsePriceField(data, "price_per_night");

        if (startDate == null || endDate == null || price == null) {
            log.warn("handleRateUpdated: donnees manquantes pour propriete Expedia {}",
                    mapping.getExternalId());
            return;
        }

        calendarEngine.updatePrice(
                mapping.getInternalId(),
                startDate,
                endDate,
                price,
                mapping.getOrganizationId(),
                "expedia-webhook"
        );

        log.info("Tarif mis a jour pour propriete {} (Expedia {}) : {} [{}, {})",
                mapping.getInternalId(), mapping.getExternalId(), price, startDate, endDate);

        auditLogService.logSync("ExpediaRate", mapping.getExternalId(),
                "Tarif Expedia synchronise pour propriete " + mapping.getInternalId());
    }

    // ================================================================
    // Helpers
    // ================================================================

    private Optional<ChannelMapping> findExpediaMapping(String expediaPropertyId, Long orgId) {
        if (expediaPropertyId == null || orgId == null) {
            return Optional.empty();
        }
        return channelMappingRepository.findByExternalIdAndChannel(
                expediaPropertyId, ChannelName.VRBO, orgId);
    }

    private Long parseOrgId(Map<String, Object> data) {
        Object orgIdObj = data.get("organization_id");
        if (orgIdObj instanceof Number number) {
            return number.longValue();
        }
        if (orgIdObj instanceof String str) {
            try {
                return Long.parseLong(str);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

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
