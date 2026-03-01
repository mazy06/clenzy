package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorAvailabilityDto;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorBookingDto;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service de synchronisation TripAdvisor Vacation Rentals.
 *
 * Responsabilites :
 * - Pousser les disponibilites vers TripAdvisor
 * - Recuperer les reservations depuis TripAdvisor (polling)
 * - Traiter les notifications webhook entrantes
 * - Deleguer les mutations calendrier au CalendarEngine
 */
@Service
public class TripAdvisorSyncService {

    private static final Logger log = LoggerFactory.getLogger(TripAdvisorSyncService.class);

    private final TripAdvisorConfig config;
    private final TripAdvisorApiClient apiClient;
    private final TripAdvisorConnectionRepository connectionRepository;

    public TripAdvisorSyncService(TripAdvisorConfig config,
                                   TripAdvisorApiClient apiClient,
                                   TripAdvisorConnectionRepository connectionRepository) {
        this.config = config;
        this.apiClient = apiClient;
        this.connectionRepository = connectionRepository;
    }

    /**
     * Pousse les disponibilites vers TripAdvisor pour une organisation.
     *
     * @param orgId organisation
     * @param from  debut de la plage (inclus)
     * @param to    fin de la plage (exclus)
     * @return nombre de jours pousses, ou -1 si pas de connexion
     */
    @Transactional
    public int pushAvailability(Long orgId, LocalDate from, LocalDate to) {
        Optional<TripAdvisorConnection> connectionOpt = connectionRepository.findByOrganizationId(orgId);
        if (connectionOpt.isEmpty() || !connectionOpt.get().isActive()) {
            log.debug("Pas de connexion TripAdvisor active pour org={}", orgId);
            return -1;
        }

        final var connection = connectionOpt.get();

        // TODO : Construire le feed disponibilite depuis le CalendarEngine
        // List<CalendarDay> days = calendarEngine.getCalendarDays(propertyId, from, to, orgId);
        // List<TripAdvisorAvailabilityDto> availability = days.stream()
        //     .map(this::toTripAdvisorAvailability)
        //     .toList();

        List<TripAdvisorAvailabilityDto> availability = List.of(); // Placeholder

        apiClient.pushAvailability(connection.getPartnerId(), availability);

        connection.setLastSyncAt(LocalDateTime.now());
        connectionRepository.save(connection);

        log.info("Push disponibilite TripAdvisor complete pour org={} ({} jours)",
                orgId, availability.size());
        return availability.size();
    }

    /**
     * Recupere les reservations depuis TripAdvisor pour une organisation.
     *
     * @param orgId organisation
     * @return liste des reservations recuperees
     */
    @Transactional
    public List<TripAdvisorBookingDto> pullBookings(Long orgId) {
        Optional<TripAdvisorConnection> connectionOpt = connectionRepository.findByOrganizationId(orgId);
        if (connectionOpt.isEmpty() || !connectionOpt.get().isActive()) {
            log.debug("Pas de connexion TripAdvisor active pour org={}", orgId);
            return List.of();
        }

        final var connection = connectionOpt.get();
        List<TripAdvisorBookingDto> bookings = apiClient.getBookings(connection.getPartnerId());

        // TODO : Pour chaque booking, creer/mettre a jour la reservation dans le PMS
        // via ReservationService ou CalendarEngine

        connection.setLastSyncAt(LocalDateTime.now());
        connectionRepository.save(connection);

        log.info("Pull bookings TripAdvisor complete pour org={} ({} reservations)",
                orgId, bookings.size());
        return bookings;
    }

    /**
     * Traite une notification webhook de reservation TripAdvisor.
     *
     * @param eventType type d'evenement (booking.created, booking.modified, booking.cancelled)
     * @param data      payload du webhook
     * @param orgId     organisation (resolu depuis le partner_id dans le webhook)
     */
    @Transactional
    public void handleBookingWebhook(String eventType, Map<String, Object> data, Long orgId) {
        log.info("Traitement webhook TripAdvisor: type={}, org={}", eventType, orgId);

        switch (eventType) {
            case "booking.created" -> handleBookingCreated(data, orgId);
            case "booking.modified" -> handleBookingModified(data, orgId);
            case "booking.cancelled" -> handleBookingCancelled(data, orgId);
            default -> log.warn("Type de webhook TripAdvisor inconnu: {}", eventType);
        }
    }

    private void handleBookingCreated(Map<String, Object> data, Long orgId) {
        String bookingId = (String) data.get("booking_id");
        log.info("Nouvelle reservation TripAdvisor: {} (org={})", bookingId, orgId);

        // TODO : Creer la reservation dans le PMS via ReservationService
        // Mapper les champs TripAdvisor vers le modele interne
        // Mettre a jour le calendrier via CalendarEngine
    }

    private void handleBookingModified(Map<String, Object> data, Long orgId) {
        String bookingId = (String) data.get("booking_id");
        log.info("Modification reservation TripAdvisor: {} (org={})", bookingId, orgId);

        // TODO : Mettre a jour la reservation dans le PMS
    }

    private void handleBookingCancelled(Map<String, Object> data, Long orgId) {
        String bookingId = (String) data.get("booking_id");
        log.info("Annulation reservation TripAdvisor: {} (org={})", bookingId, orgId);

        // TODO : Annuler la reservation dans le PMS
        // Debloquer les dates dans le calendrier via CalendarEngine
    }
}
