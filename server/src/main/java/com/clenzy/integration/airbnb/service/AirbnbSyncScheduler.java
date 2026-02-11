package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler de synchronisation Airbnb.
 *
 * Jobs planifies :
 * - Rafraichissement automatique des tokens OAuth avant expiration
 * - Sync periodique des reservations (polling complementaire aux webhooks)
 * - Sync periodique du calendrier
 * - Nettoyage des evenements webhook anciens
 */
@Service
public class AirbnbSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(AirbnbSyncScheduler.class);

    private final AirbnbConfig config;
    private final AirbnbConnectionRepository connectionRepository;
    private final AirbnbListingMappingRepository listingMappingRepository;
    private final AirbnbOAuthService oAuthService;

    public AirbnbSyncScheduler(AirbnbConfig config,
                               AirbnbConnectionRepository connectionRepository,
                               AirbnbListingMappingRepository listingMappingRepository,
                               AirbnbOAuthService oAuthService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.listingMappingRepository = listingMappingRepository;
        this.oAuthService = oAuthService;
    }

    /**
     * Rafraichit automatiquement les tokens OAuth proches de l'expiration.
     * Toutes les 30 minutes.
     */
    @Scheduled(fixedRate = 1800000) // 30 min
    public void refreshExpiringTokens() {
        if (!config.isSyncEnabled()) {
            return;
        }

        log.debug("Verification des tokens Airbnb proches de l'expiration...");

        List<AirbnbConnection> activeConnections = connectionRepository
                .findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);

        LocalDateTime expirationThreshold = LocalDateTime.now().plusMinutes(60);

        for (AirbnbConnection connection : activeConnections) {
            if (connection.getTokenExpiresAt() != null
                    && connection.getTokenExpiresAt().isBefore(expirationThreshold)) {
                try {
                    oAuthService.refreshToken(connection.getUserId());
                    log.info("Token Airbnb rafraichi pour user {}", connection.getUserId());
                } catch (Exception e) {
                    log.error("Echec rafraichissement token Airbnb pour user {}: {}",
                            connection.getUserId(), e.getMessage());
                }
            }
        }
    }

    /**
     * Sync periodique des reservations (complementaire aux webhooks).
     * Toutes les 15 minutes par defaut.
     */
    @Scheduled(fixedRateString = "${airbnb.sync.interval-minutes:15}000")
    public void syncReservations() {
        if (!config.isSyncEnabled()) {
            return;
        }

        log.debug("Sync periodique des reservations Airbnb...");

        List<AirbnbListingMapping> activeMappings = listingMappingRepository.findBySyncEnabled(true);

        for (AirbnbListingMapping mapping : activeMappings) {
            try {
                // TODO : Appeler l'API Airbnb pour recuperer les reservations recentes
                // AirbnbApiClient.getReservations(listing.getAirbnbListingId(), lastSyncAt)

                mapping.setLastSyncAt(LocalDateTime.now());
                listingMappingRepository.save(mapping);

            } catch (Exception e) {
                log.error("Erreur sync reservations pour listing {}: {}",
                        mapping.getAirbnbListingId(), e.getMessage());
            }
        }
    }

    /**
     * Nettoyage des evenements webhook traites de plus de 30 jours.
     * Tous les jours a 3h du matin.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupOldWebhookEvents() {
        log.info("Nettoyage des evenements webhook anciens...");
        // TODO : Supprimer les evenements PROCESSED de plus de 30 jours
        // webhookEventRepository.deleteByStatusAndReceivedAtBefore(
        //     WebhookEventStatus.PROCESSED, LocalDateTime.now().minusDays(30));
    }
}
