package com.clenzy.integration.booking.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.CalendarEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Service de synchronisation du calendrier Booking.com.
 *
 * Ecoute le topic Kafka booking.calendar.sync pour :
 * - Mettre a jour les disponibilites des proprietes
 * - Mettre a jour les prix (rates.updated)
 * - Gerer les restrictions (restrictions.updated)
 *
 * Delegue les mutations calendrier au CalendarEngine qui gere
 * les advisory locks et l'anti-double-booking.
 *
 * orgId est resolu via ChannelMapping (pas de TenantContext
 * car les Kafka consumers s'executent hors contexte HTTP).
 *
 * Desactive par defaut — activer via booking.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "booking.sync.enabled", havingValue = "true")
public class BookingCalendarService {

    private static final Logger log = LoggerFactory.getLogger(BookingCalendarService.class);

    private final ChannelMappingRepository channelMappingRepository;
    private final BookingConnectionRepository bookingConnectionRepository;
    private final AuditLogService auditLogService;
    private final CalendarEngine calendarEngine;
    private final BookingRestrictionRepository bookingRestrictionRepository;
    private final PropertyRepository propertyRepository;

    public BookingCalendarService(ChannelMappingRepository channelMappingRepository,
                                  BookingConnectionRepository bookingConnectionRepository,
                                  AuditLogService auditLogService,
                                  CalendarEngine calendarEngine,
                                  BookingRestrictionRepository bookingRestrictionRepository,
                                  PropertyRepository propertyRepository) {
        this.channelMappingRepository = channelMappingRepository;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.auditLogService = auditLogService;
        this.calendarEngine = calendarEngine;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
        this.propertyRepository = propertyRepository;
    }

    /**
     * Consumer Kafka pour les evenements calendrier Booking.com.
     *
     * @Transactional ici car les methodes privees appelees en interne
     * ne peuvent pas etre interceptees par Spring AOP (proxy-based).
     * CalendarEngine est deja @Transactional, mais on enveloppe tout
     * le traitement pour que les appels auditLogService partagent
     * la meme transaction.
     */
    @Transactional
    @KafkaListener(topics = "booking.calendar.sync", groupId = "clenzy-booking-calendar")
    public void handleCalendarEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String hotelId = (String) event.get("hotel_id");

        log.info("Traitement evenement calendrier Booking.com: {} (hotel={})", eventType, hotelId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement calendrier Booking.com sans data: hotel={}", hotelId);
                return;
            }

            String roomId = (String) data.get("room_id");
            Optional<ChannelMapping> mappingOpt = channelMappingRepository
                    .findByExternalIdAndChannel(roomId, ChannelName.BOOKING, resolveOrgId(hotelId));

            if (mappingOpt.isEmpty()) {
                log.warn("Room Booking.com {} non liee, evenement calendrier ignore", roomId);
                return;
            }

            ChannelMapping mapping = mappingOpt.get();

            switch (eventType) {
                case "availability.updated" -> handleAvailabilityUpdated(mapping, data);
                case "rates.updated" -> handleRatesUpdated(mapping, data);
                case "restrictions.updated" -> handleRestrictionsUpdated(mapping, data);
                default -> log.warn("Type d'evenement calendrier Booking.com inconnu: {}", eventType);
            }

        } catch (CalendarLockException e) {
            log.warn("Lock calendrier non disponible pour hotel {} — reessayer", hotelId);
            throw e; // Kafka renverra le message
        } catch (Exception e) {
            log.error("Erreur traitement calendrier Booking.com hotel={}: {}", hotelId, e.getMessage(), e);
        }
    }

    /**
     * Met a jour les disponibilites dans le calendrier Clenzy.
     * Appele sur un evenement "availability.updated" de Booking.com.
     */
    private void handleAvailabilityUpdated(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleAvailabilityUpdated: dates manquantes pour mapping {}", mapping.getExternalId());
            return;
        }

        Object availableObj = data.get("available");
        boolean available = availableObj instanceof Boolean b ? b : true;

        Long propertyId = mapping.getInternalId();
        Long orgId = mapping.getOrganizationId();

        if (available) {
            try {
                calendarEngine.unblock(propertyId, startDate, endDate, orgId, "booking-webhook");
                log.info("Dates debloquees pour propriete {} (Booking room {}) [{}, {})",
                        propertyId, mapping.getExternalId(), startDate, endDate);
            } catch (CalendarLockException e) {
                throw e; // Propagee pour retry Kafka
            }
        } else {
            try {
                calendarEngine.block(
                        propertyId, startDate, endDate, orgId,
                        "BOOKING",
                        "Bloque via Booking.com (room " + mapping.getExternalId() + ")",
                        "booking-webhook"
                );
                log.info("Dates bloquees pour propriete {} (Booking room {}) [{}, {})",
                        propertyId, mapping.getExternalId(), startDate, endDate);
            } catch (CalendarConflictException e) {
                log.warn("Conflit calendrier lors du blocage Booking.com pour propriete {} [{}, {}) : {}",
                        propertyId, startDate, endDate, e.getMessage());
            } catch (CalendarLockException e) {
                throw e; // Propagee pour retry Kafka
            }
        }

        auditLogService.logSync("BookingCalendar", mapping.getExternalId(),
                "Disponibilite Booking.com synchronisee pour propriete " + propertyId);
    }

    /**
     * Met a jour les prix dans le calendrier Clenzy.
     * Appele sur un evenement "rates.updated" de Booking.com.
     */
    private void handleRatesUpdated(ChannelMapping mapping, Map<String, Object> data) {
        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleRatesUpdated: dates manquantes pour mapping {}", mapping.getExternalId());
            auditLogService.logSync("BookingCalendar", mapping.getExternalId(),
                    "Prix Booking.com synchronise pour propriete " + mapping.getInternalId() + " (dates manquantes)");
            return;
        }

        BigDecimal price = parsePriceField(data, "price");

        if (price != null) {
            try {
                calendarEngine.updatePrice(
                        mapping.getInternalId(),
                        startDate,
                        endDate,
                        price,
                        mapping.getOrganizationId(),
                        "booking-webhook"
                );
                log.info("Prix mis a jour pour propriete {} (Booking room {}) : {} [{}, {})",
                        mapping.getInternalId(), mapping.getExternalId(), price, startDate, endDate);
            } catch (CalendarLockException e) {
                log.warn("Lock calendrier non disponible pour propriete {} — reessayer", mapping.getInternalId());
                throw e;
            }
        }

        auditLogService.logSync("BookingCalendar", mapping.getExternalId(),
                "Prix Booking.com synchronise pour propriete " + mapping.getInternalId());
    }

    /**
     * Traite les mises a jour de restrictions (min/max stay, CTA, CTD).
     * Appele sur un evenement "restrictions.updated" de Booking.com.
     *
     * Parse le payload webhook Booking.com et upsert une BookingRestriction locale.
     */
    private void handleRestrictionsUpdated(ChannelMapping mapping, Map<String, Object> data) {
        Long propertyId = mapping.getInternalId();
        Long orgId = mapping.getOrganizationId();

        log.info("Restrictions Booking.com mises a jour pour propriete {} (room {})",
                propertyId, mapping.getExternalId());

        LocalDate startDate = parseDateField(data, "start_date");
        LocalDate endDate = parseDateField(data, "end_date");

        if (startDate == null || endDate == null) {
            log.warn("handleRestrictionsUpdated: dates manquantes pour mapping {}", mapping.getExternalId());
            auditLogService.logSync("BookingCalendar", mapping.getExternalId(),
                    "Restrictions Booking.com — dates manquantes pour propriete " + propertyId);
            return;
        }

        // Parse restriction fields from Booking.com webhook payload
        Integer minStay = parseIntField(data, "min_stay");
        Integer maxStay = parseIntField(data, "max_stay");
        Boolean closedToArrival = parseBoolField(data, "closed_to_arrival");
        Boolean closedToDeparture = parseBoolField(data, "closed_to_departure");

        // Upsert restriction locale
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            log.warn("handleRestrictionsUpdated: propriete {} introuvable", propertyId);
            return;
        }

        // Chercher une restriction existante pour cette plage
        java.util.List<BookingRestriction> existing = bookingRestrictionRepository
                .findApplicable(propertyId, startDate, endDate, orgId);

        BookingRestriction restriction;
        if (!existing.isEmpty()) {
            // Mettre a jour la restriction existante la plus prioritaire
            restriction = existing.getFirst();
        } else {
            restriction = new BookingRestriction(property, startDate, endDate, orgId);
        }

        if (minStay != null) restriction.setMinStay(minStay);
        if (maxStay != null) restriction.setMaxStay(maxStay);
        if (closedToArrival != null) restriction.setClosedToArrival(closedToArrival);
        if (closedToDeparture != null) restriction.setClosedToDeparture(closedToDeparture);

        bookingRestrictionRepository.save(restriction);

        log.info("Restriction upsertee pour propriete {} [{}, {}): minStay={}, maxStay={}, CTA={}, CTD={}",
                propertyId, startDate, endDate, minStay, maxStay, closedToArrival, closedToDeparture);

        auditLogService.logSync("BookingCalendar", mapping.getExternalId(),
                "Restrictions Booking.com synchronisees pour propriete " + propertyId);
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Resout l'orgId depuis un hotelId Booking.com.
     */
    private Long resolveOrgId(String hotelId) {
        return bookingConnectionRepository.findByHotelId(hotelId)
                .map(BookingConnection::getOrganizationId)
                .orElse(null);
    }

    /**
     * Parse un champ date depuis le data Map.
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
     * Parse un champ entier depuis le data Map.
     */
    private Integer parseIntField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            if (value instanceof Number number) return number.intValue();
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Format entier invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }

    /**
     * Parse un champ booleen depuis le data Map.
     */
    private Boolean parseBoolField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        return Boolean.valueOf(value.toString());
    }

    /**
     * Parse un champ prix depuis le data Map.
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
