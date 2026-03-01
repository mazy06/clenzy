package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Scheduler de synchronisation TripAdvisor Vacation Rentals.
 *
 * Jobs planifies :
 * - Push periodique des disponibilites vers TripAdvisor
 * - Pull periodique des reservations (complementaire aux webhooks)
 *
 * Active uniquement si tripadvisor.sync.enabled=true.
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par organisation pour isoler les erreurs.
 */
@Service
@ConditionalOnProperty(name = "tripadvisor.sync.enabled", havingValue = "true")
public class TripAdvisorSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(TripAdvisorSyncScheduler.class);

    private final TripAdvisorConfig config;
    private final TripAdvisorConnectionRepository connectionRepository;
    private final TripAdvisorSyncService syncService;

    public TripAdvisorSyncScheduler(TripAdvisorConfig config,
                                     TripAdvisorConnectionRepository connectionRepository,
                                     TripAdvisorSyncService syncService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.syncService = syncService;
    }

    /**
     * Push periodique des disponibilites vers TripAdvisor.
     * Frequence configurable via tripadvisor.sync.interval-minutes (defaut: 15 min).
     */
    @Scheduled(fixedRateString = "${tripadvisor.sync.interval-minutes:15}000")
    public void pushAvailability() {
        if (!config.isConfigured()) {
            return;
        }

        log.debug("Push periodique disponibilites vers TripAdvisor...");

        List<TripAdvisorConnection> activeConnections = connectionRepository
                .findByStatus(TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE);

        final var from = LocalDate.now();
        final var to = from.plusMonths(12);
        int successCount = 0;

        for (TripAdvisorConnection connection : activeConnections) {
            try {
                int pushed = syncService.pushAvailability(
                        connection.getOrganizationId(), from, to);
                if (pushed >= 0) {
                    successCount++;
                }
            } catch (Exception e) {
                log.error("Erreur push disponibilite TripAdvisor pour org={}: {}",
                        connection.getOrganizationId(), e.getMessage());
            }
        }

        log.debug("Push disponibilite TripAdvisor termine : {}/{} orgs OK",
                successCount, activeConnections.size());
    }

    /**
     * Pull periodique des reservations depuis TripAdvisor.
     * Complementaire aux webhooks — rattrape les evenements manques.
     * Toutes les 15 minutes.
     */
    @Scheduled(fixedRateString = "${tripadvisor.sync.interval-minutes:15}000")
    public void pullBookings() {
        if (!config.isConfigured()) {
            return;
        }

        log.debug("Pull periodique des reservations TripAdvisor...");

        List<TripAdvisorConnection> activeConnections = connectionRepository
                .findByStatus(TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE);

        int successCount = 0;

        for (TripAdvisorConnection connection : activeConnections) {
            try {
                syncService.pullBookings(connection.getOrganizationId());
                successCount++;
            } catch (Exception e) {
                log.error("Erreur pull bookings TripAdvisor pour org={}: {}",
                        connection.getOrganizationId(), e.getMessage());
            }
        }

        log.debug("Pull bookings TripAdvisor termine : {}/{} orgs OK",
                successCount, activeConnections.size());
    }
}
