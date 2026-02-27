package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.dto.HotelsComReservationDto;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Service de synchronisation Hotels.com.
 *
 * Gere a la fois le calendrier (OUTBOUND) et les reservations (INBOUND).
 * Hotels.com/Expedia utilise un modele polling : les reservations sont
 * recuperees periodiquement via l'API EPC.
 */
@Service
public class HotelsComSyncService {

    private static final Logger log = LoggerFactory.getLogger(HotelsComSyncService.class);

    private final HotelsComConnectionRepository connectionRepository;
    private final HotelsComApiClient apiClient;
    private final AuditLogService auditLogService;

    public HotelsComSyncService(HotelsComConnectionRepository connectionRepository,
                                HotelsComApiClient apiClient,
                                AuditLogService auditLogService) {
        this.connectionRepository = connectionRepository;
        this.apiClient = apiClient;
        this.auditLogService = auditLogService;
    }

    /**
     * Traite la creation d'une reservation Hotels.com.
     */
    @Transactional
    public void handleReservationCreated(Map<String, Object> data) {
        String confirmationNumber = (String) data.get("confirmation_number");
        String propertyId = (String) data.get("property_id");

        log.info("Nouvelle reservation Hotels.com: confirmation={}, propertyId={}",
                confirmationNumber, propertyId);

        Optional<HotelsComConnection> connectionOpt = connectionRepository.findByPropertyId(propertyId);
        if (connectionOpt.isEmpty()) {
            log.warn("Propriete Hotels.com {} non liee, reservation ignoree", propertyId);
            return;
        }

        HotelsComReservationDto reservation = mapToReservationDto(data);

        // TODO : Creer la reservation dans le PMS et auto-generer l'intervention de menage
        // ReservationService.createFromChannel(reservation, ChannelName.HOTELS_COM, connection.getOrganizationId())

        auditLogService.logSync("HotelsComReservation", confirmationNumber,
                "Reservation Hotels.com recue pour propriete " + propertyId);
    }

    /**
     * Traite la mise a jour d'une reservation Hotels.com.
     */
    @Transactional
    public void handleReservationUpdated(Map<String, Object> data) {
        String confirmationNumber = (String) data.get("confirmation_number");
        String propertyId = (String) data.get("property_id");

        log.info("Mise a jour reservation Hotels.com: confirmation={}, propertyId={}",
                confirmationNumber, propertyId);

        // TODO : Mettre a jour la reservation existante dans le PMS
        // ReservationService.updateFromChannel(confirmationNumber, data, ChannelName.HOTELS_COM)

        auditLogService.logSync("HotelsComReservation", confirmationNumber,
                "Reservation Hotels.com mise a jour pour propriete " + propertyId);
    }

    /**
     * Traite l'annulation d'une reservation Hotels.com.
     */
    @Transactional
    public void handleReservationCancelled(Map<String, Object> data) {
        String confirmationNumber = (String) data.get("confirmation_number");
        String propertyId = (String) data.get("property_id");

        log.info("Annulation reservation Hotels.com: confirmation={}, propertyId={}",
                confirmationNumber, propertyId);

        // TODO : Annuler la reservation et les interventions liees dans le PMS
        // ReservationService.cancelFromChannel(confirmationNumber, ChannelName.HOTELS_COM)

        auditLogService.logSync("HotelsComReservation", confirmationNumber,
                "Reservation Hotels.com annulee pour propriete " + propertyId);
    }

    private HotelsComReservationDto mapToReservationDto(Map<String, Object> data) {
        return new HotelsComReservationDto(
                (String) data.get("confirmation_number"),
                (String) data.get("property_id"),
                (String) data.get("room_type_id"),
                (String) data.get("guest_first_name"),
                (String) data.get("guest_last_name"),
                (String) data.get("guest_email"),
                (String) data.get("guest_phone"),
                parseDateField(data, "check_in"),
                parseDateField(data, "check_out"),
                (String) data.get("status"),
                parsePriceField(data, "total_amount"),
                (String) data.getOrDefault("currency", "EUR"),
                data.containsKey("number_of_guests") ? ((Number) data.get("number_of_guests")).intValue() : 1,
                data.containsKey("number_of_rooms") ? ((Number) data.get("number_of_rooms")).intValue() : 1,
                (String) data.get("special_requests"),
                "hotels.com"
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
