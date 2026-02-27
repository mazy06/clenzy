package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.dto.HotelsComReservationDto;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
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
 * Scheduler de synchronisation Hotels.com.
 *
 * Jobs planifies :
 * - Polling periodique des reservations depuis Expedia Partner Central
 * - Verification de sante des connexions
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par connexion pour isoler les erreurs.
 *
 * Active uniquement si hotelscom.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "hotelscom.sync.enabled", havingValue = "true")
public class HotelsComSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(HotelsComSyncScheduler.class);

    private final HotelsComConfig config;
    private final HotelsComConnectionRepository connectionRepository;
    private final HotelsComApiClient apiClient;
    private final HotelsComSyncService syncService;

    public HotelsComSyncScheduler(HotelsComConfig config,
                                  HotelsComConnectionRepository connectionRepository,
                                  HotelsComApiClient apiClient,
                                  HotelsComSyncService syncService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.apiClient = apiClient;
        this.syncService = syncService;
    }

    /**
     * Polling periodique des reservations Hotels.com.
     * Recupere les nouvelles reservations depuis le dernier sync.
     * Toutes les 15 minutes par defaut.
     */
    @Scheduled(fixedRateString = "${hotelscom.sync.interval-minutes:15}000")
    public void syncReservations() {
        log.debug("Sync periodique des reservations Hotels.com...");

        List<HotelsComConnection> activeConnections = connectionRepository.findAllActive();

        int totalConnections = activeConnections.size();
        int successCount = 0;

        for (HotelsComConnection connection : activeConnections) {
            try {
                LocalDate from = connection.getLastSyncAt() != null
                        ? connection.getLastSyncAt().toLocalDate()
                        : LocalDate.now().minusDays(7);
                LocalDate to = LocalDate.now().plusDays(90);

                List<HotelsComReservationDto> reservations = apiClient.getReservations(
                        connection.getPropertyId(), from, to);

                log.debug("Hotels.com sync: {} reservations pour propriete {} (org={})",
                        reservations.size(), connection.getPropertyId(), connection.getOrganizationId());

                // Traiter chaque reservation
                for (HotelsComReservationDto reservation : reservations) {
                    try {
                        Map<String, Object> data = Map.of(
                                "confirmation_number", reservation.confirmationNumber(),
                                "property_id", reservation.propertyId(),
                                "guest_first_name", reservation.guestFirstName() != null ? reservation.guestFirstName() : "",
                                "guest_last_name", reservation.guestLastName() != null ? reservation.guestLastName() : "",
                                "check_in", reservation.checkIn().toString(),
                                "check_out", reservation.checkOut().toString(),
                                "status", reservation.status() != null ? reservation.status() : "CONFIRMED"
                        );
                        syncService.handleReservationCreated(data);
                    } catch (Exception e) {
                        log.error("Erreur traitement reservation Hotels.com {}: {}",
                                reservation.confirmationNumber(), e.getMessage());
                    }
                }

                connection.setLastSyncAt(LocalDateTime.now());
                connection.setErrorMessage(null);
                connectionRepository.save(connection);

                successCount++;

            } catch (Exception e) {
                log.error("Erreur sync Hotels.com pour propriete {} (org={}): {}",
                        connection.getPropertyId(), connection.getOrganizationId(), e.getMessage());

                connection.setErrorMessage("Sync echoue: " + e.getMessage());
                connection.setStatus(HotelsComConnection.HotelsComConnectionStatus.ERROR);
                connectionRepository.save(connection);
            }
        }

        log.debug("Sync Hotels.com terminee : {}/{} connexions OK", successCount, totalConnections);
    }

    /**
     * Verification de sante des connexions Hotels.com.
     * Toutes les heures, verifie que les credentials sont toujours valides.
     */
    @Scheduled(fixedRate = 3600000) // 1 heure
    public void checkConnectionHealth() {
        log.debug("Verification de sante des connexions Hotels.com...");

        List<HotelsComConnection> activeConnections = connectionRepository.findAllActive();

        for (HotelsComConnection connection : activeConnections) {
            try {
                // Appel leger pour verifier que les credentials fonctionnent
                apiClient.getAvailability(
                        connection.getPropertyId(),
                        LocalDate.now(),
                        LocalDate.now().plusDays(1)
                );

                if (connection.getStatus() == HotelsComConnection.HotelsComConnectionStatus.ERROR) {
                    connection.setStatus(HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
                    connection.setErrorMessage(null);
                    connectionRepository.save(connection);
                    log.info("Connexion Hotels.com {} retablie (org={})",
                            connection.getPropertyId(), connection.getOrganizationId());
                }

            } catch (Exception e) {
                log.warn("Health check Hotels.com echoue pour propriete {} (org={}): {}",
                        connection.getPropertyId(), connection.getOrganizationId(), e.getMessage());

                connection.setStatus(HotelsComConnection.HotelsComConnectionStatus.ERROR);
                connection.setErrorMessage("Health check echoue: " + e.getMessage());
                connectionRepository.save(connection);
            }
        }
    }
}
