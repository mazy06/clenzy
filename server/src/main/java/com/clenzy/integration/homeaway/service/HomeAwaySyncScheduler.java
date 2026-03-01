package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.dto.HomeAwayReservationDto;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
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
 * Scheduler de synchronisation HomeAway/Abritel.
 *
 * Jobs planifies :
 * - Rafraichissement automatique des tokens OAuth avant expiration
 * - Polling periodique des reservations (complementaire aux webhooks)
 * - Verification de sante des connexions
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par connexion pour isoler les erreurs.
 *
 * Active uniquement si homeaway.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "homeaway.sync.enabled", havingValue = "true")
public class HomeAwaySyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(HomeAwaySyncScheduler.class);

    private final HomeAwayConfig config;
    private final HomeAwayConnectionRepository connectionRepository;
    private final HomeAwayApiClient apiClient;
    private final HomeAwayOAuthService oAuthService;
    private final HomeAwaySyncService syncService;

    public HomeAwaySyncScheduler(HomeAwayConfig config,
                                 HomeAwayConnectionRepository connectionRepository,
                                 HomeAwayApiClient apiClient,
                                 HomeAwayOAuthService oAuthService,
                                 HomeAwaySyncService syncService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.apiClient = apiClient;
        this.oAuthService = oAuthService;
        this.syncService = syncService;
    }

    /**
     * Rafraichit automatiquement les tokens OAuth proches de l'expiration.
     * Toutes les 30 minutes.
     */
    @Scheduled(fixedRate = 1800000) // 30 min
    public void refreshExpiringTokens() {
        log.debug("Verification des tokens HomeAway proches de l'expiration...");

        List<HomeAwayConnection> activeConnections = connectionRepository.findAllActive();
        LocalDateTime expirationThreshold = LocalDateTime.now().plusMinutes(60);

        for (HomeAwayConnection connection : activeConnections) {
            try {
                if (connection.getTokenExpiresAt() != null
                        && connection.getTokenExpiresAt().isBefore(expirationThreshold)) {
                    oAuthService.refreshToken(connection.getOrganizationId());
                    log.info("Token HomeAway rafraichi pour org={}", connection.getOrganizationId());
                }
            } catch (Exception e) {
                log.error("Echec refresh token HomeAway org={}: {}",
                        connection.getOrganizationId(), e.getMessage());
            }
        }
    }

    /**
     * Polling periodique des reservations HomeAway.
     * Complementaire aux webhooks, recupere les reservations qui auraient pu etre manquees.
     * Toutes les 15 minutes par defaut.
     */
    @Scheduled(fixedRateString = "${homeaway.sync.interval-minutes:15}000")
    public void syncReservations() {
        log.debug("Sync periodique des reservations HomeAway...");

        List<HomeAwayConnection> activeConnections = connectionRepository.findAllActive();

        int totalConnections = activeConnections.size();
        int successCount = 0;

        for (HomeAwayConnection connection : activeConnections) {
            try {
                String accessToken = oAuthService.getValidAccessToken(connection.getOrganizationId());

                LocalDate from = connection.getLastSyncAt() != null
                        ? connection.getLastSyncAt().toLocalDate()
                        : LocalDate.now().minusDays(7);
                LocalDate to = LocalDate.now().plusDays(90);

                if (connection.getListingId() != null) {
                    List<HomeAwayReservationDto> reservations = apiClient.getReservations(
                            connection.getListingId(), from, to, accessToken);

                    log.debug("HomeAway sync: {} reservations pour listing {} (org={})",
                            reservations.size(), connection.getListingId(), connection.getOrganizationId());

                    // Traiter chaque reservation
                    for (HomeAwayReservationDto reservation : reservations) {
                        try {
                            Map<String, Object> data = Map.of(
                                    "reservation_id", reservation.reservationId(),
                                    "listing_id", reservation.listingId(),
                                    "guest_first_name", reservation.guestFirstName() != null ? reservation.guestFirstName() : "",
                                    "guest_last_name", reservation.guestLastName() != null ? reservation.guestLastName() : "",
                                    "check_in", reservation.checkIn().toString(),
                                    "check_out", reservation.checkOut().toString(),
                                    "status", reservation.status() != null ? reservation.status() : "CONFIRMED"
                            );
                            syncService.handleReservationCreated(data, connection.getOrganizationId());
                        } catch (Exception e) {
                            log.error("Erreur traitement reservation HomeAway {}: {}",
                                    reservation.reservationId(), e.getMessage());
                        }
                    }
                }

                connection.setLastSyncAt(LocalDateTime.now());
                connection.setErrorMessage(null);
                connectionRepository.save(connection);

                successCount++;

            } catch (Exception e) {
                log.error("Erreur sync HomeAway pour listing {} (org={}): {}",
                        connection.getListingId(), connection.getOrganizationId(), e.getMessage());

                connection.setErrorMessage("Sync echoue: " + e.getMessage());
                connectionRepository.save(connection);
            }
        }

        log.debug("Sync HomeAway terminee : {}/{} connexions OK", successCount, totalConnections);
    }
}
