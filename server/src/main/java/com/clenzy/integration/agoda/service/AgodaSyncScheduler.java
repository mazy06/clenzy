package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.dto.AgodaReservationDto;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler de synchronisation Agoda.
 *
 * Jobs planifies :
 * - Polling periodique des reservations (Agoda ne supporte pas les webhooks temps reel)
 * - Verification de sante des connexions
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par organisation pour isoler les erreurs.
 *
 * Active uniquement si agoda.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "agoda.sync.enabled", havingValue = "true")
public class AgodaSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(AgodaSyncScheduler.class);

    private final AgodaConfig config;
    private final AgodaConnectionRepository connectionRepository;
    private final AgodaApiClient agodaApiClient;

    public AgodaSyncScheduler(AgodaConfig config,
                              AgodaConnectionRepository connectionRepository,
                              AgodaApiClient agodaApiClient) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.agodaApiClient = agodaApiClient;
    }

    /**
     * Polling periodique des reservations Agoda.
     * Recupere les nouvelles reservations depuis le dernier sync.
     * Toutes les 15 minutes par defaut.
     */
    @Scheduled(fixedRateString = "${agoda.sync.interval-minutes:15}000")
    public void syncReservations() {
        log.debug("Sync periodique des reservations Agoda...");

        List<AgodaConnection> activeConnections = connectionRepository.findAllActive();

        int totalConnections = activeConnections.size();
        int successCount = 0;

        for (AgodaConnection connection : activeConnections) {
            try {
                LocalDate from = connection.getLastSyncAt() != null
                        ? connection.getLastSyncAt().toLocalDate()
                        : LocalDate.now().minusDays(7);
                LocalDate to = LocalDate.now().plusDays(90);

                List<AgodaReservationDto> reservations = agodaApiClient.getReservations(
                        connection.getPropertyId(), from, to);

                log.debug("Agoda sync: {} reservations pour propriete {} (org={})",
                        reservations.size(), connection.getPropertyId(), connection.getOrganizationId());

                // TODO : Traiter chaque reservation via AgodaReservationService
                // pour creer/mettre a jour les reservations dans le PMS

                connection.setLastSyncAt(LocalDateTime.now());
                connection.setErrorMessage(null);
                connectionRepository.save(connection);

                successCount++;

            } catch (Exception e) {
                log.error("Erreur sync Agoda pour propriete {} (org={}): {}",
                        connection.getPropertyId(), connection.getOrganizationId(), e.getMessage());

                connection.setErrorMessage("Sync echoue: " + e.getMessage());
                connection.setStatus(AgodaConnection.AgodaConnectionStatus.ERROR);
                connectionRepository.save(connection);
            }
        }

        log.debug("Sync Agoda terminee : {}/{} connexions OK", successCount, totalConnections);
    }

    /**
     * Verification de sante des connexions Agoda.
     * Toutes les heures, verifie que les API keys sont toujours valides.
     */
    @Scheduled(fixedRate = 3600000) // 1 heure
    public void checkConnectionHealth() {
        log.debug("Verification de sante des connexions Agoda...");

        List<AgodaConnection> activeConnections = connectionRepository.findAllActive();

        for (AgodaConnection connection : activeConnections) {
            try {
                // Appel leger pour verifier que les credentials fonctionnent
                agodaApiClient.getAvailability(
                        connection.getPropertyId(),
                        LocalDate.now(),
                        LocalDate.now().plusDays(1)
                );

                if (connection.getStatus() == AgodaConnection.AgodaConnectionStatus.ERROR) {
                    connection.setStatus(AgodaConnection.AgodaConnectionStatus.ACTIVE);
                    connection.setErrorMessage(null);
                    connectionRepository.save(connection);
                    log.info("Connexion Agoda {} retablie (org={})",
                            connection.getPropertyId(), connection.getOrganizationId());
                }

            } catch (Exception e) {
                log.warn("Health check Agoda echoue pour propriete {} (org={}): {}",
                        connection.getPropertyId(), connection.getOrganizationId(), e.getMessage());

                connection.setStatus(AgodaConnection.AgodaConnectionStatus.ERROR);
                connection.setErrorMessage("Health check echoue: " + e.getMessage());
                connectionRepository.save(connection);
            }
        }
    }
}
