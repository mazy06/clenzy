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
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Scheduler de synchronisation Airbnb.
 *
 * Jobs planifies :
 * - Rafraichissement automatique des tokens OAuth avant expiration
 * - Sync periodique des reservations (polling complementaire aux webhooks)
 * - Nettoyage des evenements webhook anciens
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le Hibernate @Filter n'est pas actif — les queries retournent les donnees de toutes les orgs.
 * Le traitement est groupe par organization_id pour :
 * - Isoler les erreurs (un echec sur une org ne bloque pas les autres)
 * - Permettre la tracabilite par tenant dans les logs
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
     * Toutes les 30 minutes. Groupe par org pour isoler les erreurs.
     */
    @Scheduled(fixedRate = 1800000) // 30 min
    public void refreshExpiringTokens() {
        if (!config.isSyncEnabled()) {
            return;
        }

        log.debug("Verification des tokens Airbnb proches de l'expiration...");

        List<AirbnbConnection> activeConnections = connectionRepository
                .findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);

        // Grouper par org pour isoler les erreurs entre tenants
        Map<Long, List<AirbnbConnection>> connectionsByOrg = activeConnections.stream()
                .filter(c -> c.getOrganizationId() != null)
                .collect(Collectors.groupingBy(AirbnbConnection::getOrganizationId));

        LocalDateTime expirationThreshold = LocalDateTime.now().plusMinutes(60);

        for (Map.Entry<Long, List<AirbnbConnection>> entry : connectionsByOrg.entrySet()) {
            Long orgId = entry.getKey();
            try {
                for (AirbnbConnection connection : entry.getValue()) {
                    if (connection.getTokenExpiresAt() != null
                            && connection.getTokenExpiresAt().isBefore(expirationThreshold)) {
                        try {
                            oAuthService.refreshToken(connection.getUserId());
                            log.info("Token Airbnb rafraichi pour user {} (org={})",
                                    connection.getUserId(), orgId);
                        } catch (Exception e) {
                            log.error("Echec refresh token Airbnb user {} (org={}): {}",
                                    connection.getUserId(), orgId, e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Erreur refresh tokens Airbnb pour org={}: {}", orgId, e.getMessage());
            }
        }
    }

    /**
     * Sync periodique des reservations (complementaire aux webhooks).
     * Toutes les 15 minutes par defaut. Groupe par org pour isoler les erreurs.
     */
    @Scheduled(fixedRateString = "${airbnb.sync.interval-minutes:15}000")
    public void syncReservations() {
        if (!config.isSyncEnabled()) {
            return;
        }

        log.debug("Sync periodique des reservations Airbnb...");

        List<AirbnbListingMapping> activeMappings = listingMappingRepository.findBySyncEnabled(true);

        // Grouper par org pour isoler les erreurs entre tenants
        Map<Long, List<AirbnbListingMapping>> mappingsByOrg = activeMappings.stream()
                .filter(m -> m.getOrganizationId() != null)
                .collect(Collectors.groupingBy(AirbnbListingMapping::getOrganizationId));

        int totalOrgs = mappingsByOrg.size();
        int successOrgs = 0;

        for (Map.Entry<Long, List<AirbnbListingMapping>> entry : mappingsByOrg.entrySet()) {
            Long orgId = entry.getKey();
            try {
                for (AirbnbListingMapping mapping : entry.getValue()) {
                    try {
                        // TODO : Appeler l'API Airbnb pour recuperer les reservations recentes
                        // AirbnbApiClient.getReservations(listing.getAirbnbListingId(), lastSyncAt)

                        mapping.setLastSyncAt(LocalDateTime.now());
                        listingMappingRepository.save(mapping);
                    } catch (Exception e) {
                        log.error("Erreur sync reservations listing {} (org={}): {}",
                                mapping.getAirbnbListingId(), orgId, e.getMessage());
                    }
                }
                successOrgs++;
            } catch (Exception e) {
                log.error("Erreur sync reservations Airbnb pour org={}: {}", orgId, e.getMessage());
            }
        }

        log.debug("Sync Airbnb terminee : {}/{} orgs OK", successOrgs, totalOrgs);
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
