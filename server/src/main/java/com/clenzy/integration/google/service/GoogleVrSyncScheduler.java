package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.model.GoogleVrConnection;
import com.clenzy.integration.google.repository.GoogleVrConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Scheduler de synchronisation Google Vacation Rentals.
 *
 * Jobs planifies :
 * - Push periodique des disponibilites et tarifs (ARI) vers Google Hotel Center
 * - Pull periodique des reservations depuis Google
 *
 * Active uniquement si google.vacation-rentals.sync.enabled=true.
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par organisation pour isoler les erreurs.
 */
@Service
@ConditionalOnProperty(name = "google.vacation-rentals.sync.enabled", havingValue = "true")
public class GoogleVrSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(GoogleVrSyncScheduler.class);

    private final GoogleVacationRentalsConfig config;
    private final GoogleVrConnectionRepository connectionRepository;
    private final GoogleVrSyncService syncService;

    public GoogleVrSyncScheduler(GoogleVacationRentalsConfig config,
                                  GoogleVrConnectionRepository connectionRepository,
                                  GoogleVrSyncService syncService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.syncService = syncService;
    }

    /**
     * Push periodique des disponibilites et tarifs vers Google Hotel Center.
     * Frequence configurable via google.vacation-rentals.sync.interval-minutes (defaut: 30 min).
     */
    @Scheduled(fixedRateString = "${google.vacation-rentals.sync.interval-minutes:30}000")
    public void pushAvailabilityAndRates() {
        if (!config.isConfigured()) {
            return;
        }

        log.debug("Push periodique ARI vers Google Vacation Rentals...");

        List<GoogleVrConnection> activeConnections = connectionRepository
                .findByStatus(GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE);

        final var from = LocalDate.now();
        final var to = from.plusMonths(12);
        int successCount = 0;

        for (GoogleVrConnection connection : activeConnections) {
            try {
                int pushed = syncService.pushAvailabilityAndRates(
                        connection.getOrganizationId(), from, to);
                if (pushed >= 0) {
                    successCount++;
                }
            } catch (Exception e) {
                log.error("Erreur push ARI Google VR pour org={}: {}",
                        connection.getOrganizationId(), e.getMessage());
            }
        }

        log.debug("Push ARI Google VR termine : {}/{} orgs OK",
                successCount, activeConnections.size());
    }

    /**
     * Pull periodique des reservations depuis Google.
     * Toutes les 30 minutes.
     */
    @Scheduled(fixedRate = 1800000) // 30 min
    public void pullBookings() {
        if (!config.isConfigured()) {
            return;
        }

        log.debug("Pull periodique des reservations Google Vacation Rentals...");

        List<GoogleVrConnection> activeConnections = connectionRepository
                .findByStatus(GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE);

        int successCount = 0;

        for (GoogleVrConnection connection : activeConnections) {
            try {
                syncService.pullBookings(connection.getOrganizationId());
                successCount++;
            } catch (Exception e) {
                log.error("Erreur pull bookings Google VR pour org={}: {}",
                        connection.getOrganizationId(), e.getMessage());
            }
        }

        log.debug("Pull bookings Google VR termine : {}/{} orgs OK",
                successCount, activeConnections.size());
    }
}
