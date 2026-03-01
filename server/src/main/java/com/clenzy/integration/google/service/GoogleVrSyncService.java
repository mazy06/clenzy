package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.dto.GoogleVrAvailabilityDto;
import com.clenzy.integration.google.dto.GoogleVrBookingDto;
import com.clenzy.integration.google.model.GoogleVrConnection;
import com.clenzy.integration.google.repository.GoogleVrConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service de synchronisation Google Vacation Rentals.
 *
 * Responsabilites :
 * - Pousser les disponibilites et tarifs (ARI) vers Google Hotel Center
 * - Recuperer les reservations depuis Google
 * - Deleguer les mutations calendrier au CalendarEngine
 *
 * Google fonctionne en mode push pour les listings et ARI, et en mode
 * pull pour les reservations. Il n'y a pas de webhook natif — la
 * recuperation des bookings se fait par polling periodique.
 */
@Service
public class GoogleVrSyncService {

    private static final Logger log = LoggerFactory.getLogger(GoogleVrSyncService.class);

    private final GoogleVacationRentalsConfig config;
    private final GoogleVrApiClient apiClient;
    private final GoogleVrConnectionRepository connectionRepository;

    public GoogleVrSyncService(GoogleVacationRentalsConfig config,
                               GoogleVrApiClient apiClient,
                               GoogleVrConnectionRepository connectionRepository) {
        this.config = config;
        this.apiClient = apiClient;
        this.connectionRepository = connectionRepository;
    }

    /**
     * Pousse les disponibilites et tarifs vers Google pour une organisation.
     *
     * @param orgId organisation
     * @param from  debut de la plage (inclus)
     * @param to    fin de la plage (exclus)
     * @return nombre de jours pousses, ou -1 si pas de connexion
     */
    @Transactional
    public int pushAvailabilityAndRates(Long orgId, LocalDate from, LocalDate to) {
        Optional<GoogleVrConnection> connectionOpt = connectionRepository.findByOrganizationId(orgId);
        if (connectionOpt.isEmpty() || !connectionOpt.get().isActive()) {
            log.debug("Pas de connexion Google VR active pour org={}", orgId);
            return -1;
        }

        final var connection = connectionOpt.get();

        // TODO : Construire le ARI feed depuis le CalendarEngine
        // List<CalendarDay> days = calendarEngine.getCalendarDays(propertyId, from, to, orgId);
        // List<GoogleVrAvailabilityDto> availability = days.stream()
        //     .map(this::toGoogleAvailability)
        //     .toList();

        List<GoogleVrAvailabilityDto> availability = List.of(); // Placeholder

        apiClient.pushAvailability(connection.getPartnerId(), availability);
        apiClient.pushRates(connection.getPartnerId(), availability);

        connection.setLastSyncAt(LocalDateTime.now());
        connectionRepository.save(connection);

        log.info("Push ARI Google VR complete pour org={} ({} jours)", orgId, availability.size());
        return availability.size();
    }

    /**
     * Recupere les reservations depuis Google pour une organisation.
     *
     * @param orgId organisation
     * @return liste des reservations recuperees
     */
    @Transactional
    public List<GoogleVrBookingDto> pullBookings(Long orgId) {
        Optional<GoogleVrConnection> connectionOpt = connectionRepository.findByOrganizationId(orgId);
        if (connectionOpt.isEmpty() || !connectionOpt.get().isActive()) {
            log.debug("Pas de connexion Google VR active pour org={}", orgId);
            return List.of();
        }

        final var connection = connectionOpt.get();
        List<GoogleVrBookingDto> bookings = apiClient.getBookings(connection.getPartnerId());

        // TODO : Pour chaque booking, creer/mettre a jour la reservation dans le PMS
        // via ReservationService ou CalendarEngine

        connection.setLastSyncAt(LocalDateTime.now());
        connectionRepository.save(connection);

        log.info("Pull bookings Google VR complete pour org={} ({} reservations)", orgId, bookings.size());
        return bookings;
    }
}
