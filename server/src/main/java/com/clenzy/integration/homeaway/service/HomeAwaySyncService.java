package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.dto.HomeAwayReservationDto;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
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
 * Service de synchronisation HomeAway/Abritel.
 *
 * Gere a la fois la disponibilite (INBOUND + OUTBOUND) et les reservations (INBOUND).
 * HomeAway supporte les webhooks pour la notification temps reel ET le polling.
 */
@Service
public class HomeAwaySyncService {

    private static final Logger log = LoggerFactory.getLogger(HomeAwaySyncService.class);

    private final HomeAwayConnectionRepository connectionRepository;
    private final HomeAwayApiClient apiClient;
    private final HomeAwayOAuthService oAuthService;
    private final AuditLogService auditLogService;

    public HomeAwaySyncService(HomeAwayConnectionRepository connectionRepository,
                               HomeAwayApiClient apiClient,
                               HomeAwayOAuthService oAuthService,
                               AuditLogService auditLogService) {
        this.connectionRepository = connectionRepository;
        this.apiClient = apiClient;
        this.oAuthService = oAuthService;
        this.auditLogService = auditLogService;
    }

    /**
     * Traite la creation d'une reservation HomeAway.
     */
    @Transactional
    public void handleReservationCreated(Map<String, Object> data, Long orgId) {
        String reservationId = (String) data.get("reservation_id");
        String listingId = (String) data.get("listing_id");

        log.info("Nouvelle reservation HomeAway: reservationId={}, listingId={}, orgId={}",
                reservationId, listingId, orgId);

        HomeAwayReservationDto reservation = mapToReservationDto(data);

        // TODO : Creer la reservation dans le PMS et auto-generer l'intervention de menage
        // ReservationService.createFromChannel(reservation, ChannelName.HOMEAWAY, orgId)

        auditLogService.logSync("HomeAwayReservation", reservationId,
                "Reservation HomeAway recue pour listing " + listingId);
    }

    /**
     * Traite la mise a jour d'une reservation HomeAway.
     */
    @Transactional
    public void handleReservationUpdated(Map<String, Object> data, Long orgId) {
        String reservationId = (String) data.get("reservation_id");
        String listingId = (String) data.get("listing_id");

        log.info("Mise a jour reservation HomeAway: reservationId={}, listingId={}", reservationId, listingId);

        // TODO : Mettre a jour la reservation existante dans le PMS
        // ReservationService.updateFromChannel(reservationId, data, ChannelName.HOMEAWAY)

        auditLogService.logSync("HomeAwayReservation", reservationId,
                "Reservation HomeAway mise a jour pour listing " + listingId);
    }

    /**
     * Traite l'annulation d'une reservation HomeAway.
     */
    @Transactional
    public void handleReservationCancelled(Map<String, Object> data, Long orgId) {
        String reservationId = (String) data.get("reservation_id");
        String listingId = (String) data.get("listing_id");

        log.info("Annulation reservation HomeAway: reservationId={}, listingId={}", reservationId, listingId);

        // TODO : Annuler la reservation et les interventions liees dans le PMS
        // ReservationService.cancelFromChannel(reservationId, ChannelName.HOMEAWAY)

        auditLogService.logSync("HomeAwayReservation", reservationId,
                "Reservation HomeAway annulee pour listing " + listingId);
    }

    /**
     * Traite une mise a jour de disponibilite inbound depuis HomeAway.
     */
    @Transactional
    public void handleAvailabilityUpdate(Map<String, Object> data, Long orgId) {
        String listingId = (String) data.get("listing_id");
        LocalDate date = parseDateField(data, "date");
        Boolean available = (Boolean) data.get("available");

        log.info("Mise a jour disponibilite HomeAway: listingId={}, date={}, available={}",
                listingId, date, available);

        // TODO : Mettre a jour le calendrier PMS via CalendarEngine
        // calendarEngine.updateAvailability(propertyId, date, available, orgId)

        auditLogService.logSync("HomeAwayAvailability", listingId,
                "Disponibilite HomeAway mise a jour pour listing " + listingId);
    }

    private HomeAwayReservationDto mapToReservationDto(Map<String, Object> data) {
        return new HomeAwayReservationDto(
                (String) data.get("reservation_id"),
                (String) data.get("listing_id"),
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
                data.containsKey("number_of_adults") ? ((Number) data.get("number_of_adults")).intValue() : 1,
                data.containsKey("number_of_children") ? ((Number) data.get("number_of_children")).intValue() : 0,
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
