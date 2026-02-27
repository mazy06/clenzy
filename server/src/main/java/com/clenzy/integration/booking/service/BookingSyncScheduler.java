package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingReservationDto;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Scheduler de synchronisation Booking.com.
 *
 * Booking.com ne pousse pas toujours les evenements via webhook,
 * un polling periodique est necessaire pour garantir la coherence.
 *
 * Jobs planifies :
 * - Polling des nouvelles reservations depuis l'API Booking.com
 * - Acquittement des reservations non acquittees
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le Hibernate @Filter n'est pas actif — les queries retournent les donnees
 * de toutes les orgs. Le traitement est groupe par organisation pour
 * isoler les erreurs entre tenants.
 */
@Service
@ConditionalOnProperty(name = "booking.sync.enabled", havingValue = "true")
public class BookingSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingSyncScheduler.class);

    private final BookingConfig config;
    private final BookingConnectionRepository connectionRepository;
    private final BookingApiClient bookingApiClient;
    private final BookingReservationService reservationService;

    public BookingSyncScheduler(BookingConfig config,
                                BookingConnectionRepository connectionRepository,
                                BookingApiClient bookingApiClient,
                                BookingReservationService reservationService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.bookingApiClient = bookingApiClient;
        this.reservationService = reservationService;
    }

    /**
     * Polling periodique des reservations Booking.com.
     * Intervalle configurable via booking.sync.interval-minutes (defaut : 10 min).
     *
     * Pour chaque connexion active, recupere les reservations recentes
     * via l'API XML et les traite comme des evenements "reservation.created".
     */
    @Scheduled(fixedRateString = "#{${booking.sync.interval-minutes:10} * 60000}")
    public void pollReservations() {
        log.debug("Polling des reservations Booking.com...");

        List<BookingConnection> activeConnections = connectionRepository.findAllActive();
        int totalConnections = activeConnections.size();
        int successCount = 0;

        for (BookingConnection connection : activeConnections) {
            try {
                pollReservationsForConnection(connection);
                successCount++;
            } catch (Exception e) {
                log.error("Erreur polling reservations Booking.com hotel={} (org={}): {}",
                        connection.getHotelId(), connection.getOrganizationId(), e.getMessage());

                connection.setErrorMessage("Polling failed: " + e.getMessage());
                connectionRepository.save(connection);
            }
        }

        log.debug("Polling Booking.com termine : {}/{} connexions OK", successCount, totalConnections);
    }

    /**
     * Polling des reservations pour une connexion specifique.
     */
    private void pollReservationsForConnection(BookingConnection connection) {
        // Calculer la date de debut de polling :
        // Si lastSyncAt existe, reprendre depuis cette date
        // Sinon, remonter a 7 jours en arriere
        LocalDate since = connection.getLastSyncAt() != null
                ? connection.getLastSyncAt().toLocalDate()
                : LocalDate.now().minusDays(7);

        List<BookingReservationDto> reservations = bookingApiClient
                .getReservations(connection.getHotelId(), since);

        if (reservations.isEmpty()) {
            log.debug("Aucune nouvelle reservation pour hotel {} (org={})",
                    connection.getHotelId(), connection.getOrganizationId());
        } else {
            log.info("{} reservation(s) recue(s) pour hotel {} (org={})",
                    reservations.size(), connection.getHotelId(), connection.getOrganizationId());

            for (BookingReservationDto reservation : reservations) {
                try {
                    // Construire le data map compatible avec le format Kafka consumer
                    Map<String, Object> data = Map.of(
                            "reservation_id", reservation.reservationId(),
                            "room_id", reservation.roomId(),
                            "guest_name", reservation.guestName() != null ? reservation.guestName() : "",
                            "check_in", reservation.checkIn().toString(),
                            "check_out", reservation.checkOut().toString(),
                            "number_of_guests", reservation.numberOfGuests()
                    );

                    reservationService.handleReservationCreated(connection.getHotelId(), data);

                    // Acquitter la reservation aupres de Booking.com
                    bookingApiClient.acknowledgeReservation(reservation.reservationId());

                } catch (Exception e) {
                    log.error("Erreur traitement reservation {} pour hotel {}: {}",
                            reservation.reservationId(), connection.getHotelId(), e.getMessage());
                }
            }
        }

        // Mettre a jour le timestamp de derniere synchronisation
        connection.setLastSyncAt(LocalDateTime.now());
        connection.setErrorMessage(null);
        connectionRepository.save(connection);
    }
}
