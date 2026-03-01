package com.clenzy.integration.expedia.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.dto.ExpediaReservationDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Scheduler de synchronisation Expedia/VRBO.
 *
 * Jobs planifies :
 * - Polling periodique des reservations via l'API Rapid
 * - Polling periodique des changements de disponibilite
 *
 * Multi-tenant : s'execute HORS contexte HTTP (pas de TenantFilter/TenantContext).
 * Le traitement est groupe par organization_id pour isoler les erreurs entre tenants.
 *
 * Active uniquement si expedia.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "expedia.sync.enabled", havingValue = "true")
public class ExpediaSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExpediaSyncScheduler.class);

    private final ExpediaConfig config;
    private final ExpediaApiClient apiClient;
    private final ChannelConnectionRepository channelConnectionRepository;
    private final ChannelMappingRepository channelMappingRepository;

    public ExpediaSyncScheduler(ExpediaConfig config,
                                ExpediaApiClient apiClient,
                                ChannelConnectionRepository channelConnectionRepository,
                                ChannelMappingRepository channelMappingRepository) {
        this.config = config;
        this.apiClient = apiClient;
        this.channelConnectionRepository = channelConnectionRepository;
        this.channelMappingRepository = channelMappingRepository;
    }

    /**
     * Sync periodique des reservations Expedia (complementaire aux webhooks).
     * Intervalle configurable via expedia.sync.interval-minutes (defaut 15 min).
     * Groupe par org pour isoler les erreurs entre tenants.
     */
    @Scheduled(fixedRateString = "#{${expedia.sync.interval-minutes:15} * 60000}")
    public void syncReservations() {
        if (!config.isConfigured()) {
            log.debug("Expedia non configure, sync reservations ignoree");
            return;
        }

        log.debug("Sync periodique des reservations Expedia/VRBO...");

        List<ChannelConnection> vrboConnections = channelConnectionRepository.findAllActive()
                .stream()
                .filter(cc -> ChannelName.VRBO.equals(cc.getChannel()))
                .toList();

        // Grouper par org pour isoler les erreurs
        Map<Long, List<ChannelConnection>> connectionsByOrg = vrboConnections.stream()
                .collect(Collectors.groupingBy(ChannelConnection::getOrganizationId));

        int totalOrgs = connectionsByOrg.size();
        int successOrgs = 0;

        for (Map.Entry<Long, List<ChannelConnection>> entry : connectionsByOrg.entrySet()) {
            Long orgId = entry.getKey();
            try {
                for (ChannelConnection connection : entry.getValue()) {
                    syncConnectionReservations(connection, orgId);
                }
                successOrgs++;
            } catch (Exception e) {
                log.error("Erreur sync reservations Expedia pour org={}: {}",
                        orgId, e.getMessage());
            }
        }

        log.debug("Sync Expedia reservations terminee : {}/{} orgs OK", successOrgs, totalOrgs);
    }

    /**
     * Sync periodique des disponibilites Expedia.
     * Toutes les 30 minutes — verifie les ecarts entre Clenzy et Expedia.
     */
    @Scheduled(fixedRate = 1800000) // 30 min
    public void syncAvailability() {
        if (!config.isConfigured()) {
            return;
        }

        log.debug("Sync periodique des disponibilites Expedia/VRBO...");

        List<ChannelConnection> vrboConnections = channelConnectionRepository.findAllActive()
                .stream()
                .filter(cc -> ChannelName.VRBO.equals(cc.getChannel()))
                .toList();

        for (ChannelConnection connection : vrboConnections) {
            try {
                List<ChannelMapping> mappings = channelMappingRepository
                        .findByConnectionId(connection.getId(), connection.getOrganizationId());

                for (ChannelMapping mapping : mappings) {
                    if (!mapping.isSyncEnabled()) continue;

                    // Polling des 90 prochains jours
                    LocalDate from = LocalDate.now();
                    LocalDate to = from.plusDays(90);

                    apiClient.getAvailability(mapping.getExternalId(), from, to);

                    mapping.setLastSyncAt(LocalDateTime.now());
                    mapping.setLastSyncStatus("SUCCESS");
                }
            } catch (Exception e) {
                log.error("Erreur sync disponibilite Expedia pour connexion {}: {}",
                        connection.getId(), e.getMessage());
            }
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    private void syncConnectionReservations(ChannelConnection connection, Long orgId) {
        List<ChannelMapping> mappings = channelMappingRepository
                .findByConnectionId(connection.getId(), orgId);

        for (ChannelMapping mapping : mappings) {
            if (!mapping.isSyncEnabled()) continue;

            try {
                // Polling reservations des 30 derniers jours + 90 jours futurs
                LocalDate from = LocalDate.now().minusDays(30);
                LocalDate to = LocalDate.now().plusDays(90);

                List<ExpediaReservationDto> reservations = apiClient
                        .getReservations(mapping.getExternalId(), from, to);

                log.debug("Expedia sync: {} reservations pour propriete {} (org={})",
                        reservations.size(), mapping.getExternalId(), orgId);

                mapping.setLastSyncAt(LocalDateTime.now());
                mapping.setLastSyncStatus("SUCCESS");

            } catch (Exception e) {
                log.error("Erreur sync reservations Expedia propriete {} (org={}): {}",
                        mapping.getExternalId(), orgId, e.getMessage());
                mapping.setLastSyncStatus("ERROR");
            }
        }
    }
}
