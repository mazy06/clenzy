package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.dto.AgodaReservationDto;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Service de gestion des reservations Agoda.
 *
 * Ecoute le topic Kafka agoda.reservations et traite les evenements :
 * - reservation.created  : nouvelle reservation depuis Agoda
 * - reservation.updated  : mise a jour d'une reservation existante
 * - reservation.cancelled: annulation d'une reservation
 *
 * Les reservations Agoda sont recuperees par polling periodique
 * (pas de webhooks temps reel disponibles sur l'API Supply).
 */
@Service
public class AgodaReservationService {

    private static final Logger log = LoggerFactory.getLogger(AgodaReservationService.class);

    private final AgodaConnectionRepository connectionRepository;
    private final AuditLogService auditLogService;

    public AgodaReservationService(AgodaConnectionRepository connectionRepository,
                                   AuditLogService auditLogService) {
        this.connectionRepository = connectionRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements de reservation Agoda.
     */
    @KafkaListener(topics = "agoda.reservations", groupId = "clenzy-agoda-reservations")
    public void handleReservationEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement reservation Agoda: {} ({})", eventType, eventId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement reservation Agoda sans data: {}", eventId);
                return;
            }

            switch (eventType) {
                case "reservation.created" -> handleReservationCreated(data);
                case "reservation.updated" -> handleReservationUpdated(data);
                case "reservation.cancelled" -> handleReservationCancelled(data);
                default -> log.warn("Type d'evenement reservation Agoda inconnu: {}", eventType);
            }

        } catch (Exception e) {
            log.error("Erreur traitement reservation Agoda {}: {}", eventId, e.getMessage(), e);
        }
    }

    /**
     * Traite la creation d'une reservation Agoda.
     */
    @Transactional
    public void handleReservationCreated(Map<String, Object> data) {
        String bookingId = (String) data.get("booking_id");
        String propertyId = (String) data.get("property_id");

        log.info("Nouvelle reservation Agoda: bookingId={}, propertyId={}", bookingId, propertyId);

        Optional<AgodaConnection> connectionOpt = connectionRepository.findByPropertyId(propertyId);
        if (connectionOpt.isEmpty()) {
            log.warn("Propriete Agoda {} non liee, reservation ignoree", propertyId);
            return;
        }

        AgodaConnection connection = connectionOpt.get();

        AgodaReservationDto reservation = mapToReservationDto(data);

        // TODO : Creer la reservation dans le PMS et auto-generer l'intervention de menage
        // ReservationService.createFromChannel(reservation, ChannelName.AGODA, connection.getOrganizationId())

        auditLogService.logSync("AgodaReservation", bookingId,
                "Reservation Agoda recue pour propriete " + propertyId);
    }

    /**
     * Traite la mise a jour d'une reservation Agoda.
     */
    @Transactional
    public void handleReservationUpdated(Map<String, Object> data) {
        String bookingId = (String) data.get("booking_id");
        String propertyId = (String) data.get("property_id");

        log.info("Mise a jour reservation Agoda: bookingId={}, propertyId={}", bookingId, propertyId);

        // TODO : Mettre a jour la reservation existante dans le PMS
        // ReservationService.updateFromChannel(bookingId, data, ChannelName.AGODA)

        auditLogService.logSync("AgodaReservation", bookingId,
                "Reservation Agoda mise a jour pour propriete " + propertyId);
    }

    /**
     * Traite l'annulation d'une reservation Agoda.
     */
    @Transactional
    public void handleReservationCancelled(Map<String, Object> data) {
        String bookingId = (String) data.get("booking_id");
        String propertyId = (String) data.get("property_id");

        log.info("Annulation reservation Agoda: bookingId={}, propertyId={}", bookingId, propertyId);

        // TODO : Annuler la reservation et les interventions liees dans le PMS
        // ReservationService.cancelFromChannel(bookingId, ChannelName.AGODA)

        auditLogService.logSync("AgodaReservation", bookingId,
                "Reservation Agoda annulee pour propriete " + propertyId);
    }

    private AgodaReservationDto mapToReservationDto(Map<String, Object> data) {
        return new AgodaReservationDto(
                (String) data.get("booking_id"),
                (String) data.get("property_id"),
                (String) data.get("room_type_id"),
                (String) data.get("guest_name"),
                (String) data.get("guest_email"),
                parseDateField(data, "check_in"),
                parseDateField(data, "check_out"),
                (String) data.get("status"),
                parsePriceField(data, "total_amount"),
                (String) data.getOrDefault("currency", "EUR"),
                data.containsKey("number_of_guests") ? ((Number) data.get("number_of_guests")).intValue() : 1,
                (String) data.get("special_requests")
        );
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

    private java.math.BigDecimal parsePriceField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            if (value instanceof Number number) {
                return java.math.BigDecimal.valueOf(number.doubleValue());
            }
            return new java.math.BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Format de prix invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }
}
