package com.clenzy.integration.channel;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.integration.agoda.service.AgodaApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Agoda.
 *
 * Delegue aux services Agoda existants sans les modifier.
 *
 * Agoda utilise un modele API key (pas d'OAuth). Les reservations
 * sont recuperees par polling periodique via {@link com.clenzy.integration.agoda.service.AgodaSyncScheduler}.
 *
 * Capacites :
 * - OUTBOUND_CALENDAR : push de disponibilite/tarifs vers Agoda
 * - INBOUND_RESERVATIONS : reception de reservations par polling
 * - POLLING : pas de webhooks temps reel
 */
@Component
public class AgodaChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(AgodaChannelAdapter.class);

    private final AgodaConfig agodaConfig;
    private final AgodaConnectionRepository agodaConnectionRepository;
    private final AgodaApiClient agodaApiClient;
    private final ChannelMappingRepository channelMappingRepository;

    public AgodaChannelAdapter(AgodaConfig agodaConfig,
                               AgodaConnectionRepository agodaConnectionRepository,
                               AgodaApiClient agodaApiClient,
                               ChannelMappingRepository channelMappingRepository) {
        this.agodaConfig = agodaConfig;
        this.agodaConnectionRepository = agodaConnectionRepository;
        this.agodaApiClient = agodaApiClient;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.AGODA;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.POLLING
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.AGODA, orgId);
    }

    /**
     * Les events inbound Agoda sont traites par le polling scheduler
     * qui publie dans Kafka, puis consomme par AgodaReservationService.
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("AgodaChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
        // Les events Agoda passent par polling → Kafka → consumers dedies
    }

    /**
     * Push calendrier vers Agoda (OUTBOUND).
     * Utilise l'API Supply pour mettre a jour la disponibilite.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Agoda pour propriete " + propertyId);
        }

        if (!agodaConfig.isConfigured()) {
            return SyncResult.skipped("Configuration Agoda incomplete");
        }

        long startTime = System.currentTimeMillis();

        try {
            String externalPropertyId = mapping.get().getExternalId();

            // Recuperer et pousser la disponibilite
            // TODO : construire la liste de disponibilite depuis le CalendarEngine
            // List<AgodaAvailabilityDto> availability = buildAvailabilityFromCalendar(propertyId, from, to, orgId);
            // agodaApiClient.updateAvailability(externalPropertyId, availability);

            log.debug("AgodaChannelAdapter: push calendrier OUTBOUND pour propriete {} -> Agoda {}",
                    propertyId, externalPropertyId);

            long duration = System.currentTimeMillis() - startTime;
            return SyncResult.skipped("Agoda outbound calendar push sera implemente en phase suivante");

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Agoda pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Push calendrier Agoda echoue: " + e.getMessage(), duration);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        try {
            AgodaConnection connection = agodaConnectionRepository.findById(connectionId).orElse(null);
            if (connection == null) {
                return HealthStatus.UNKNOWN;
            }

            return switch (connection.getStatus()) {
                case ACTIVE -> HealthStatus.HEALTHY;
                case ERROR -> HealthStatus.UNHEALTHY;
                case INACTIVE -> HealthStatus.DEGRADED;
            };
        } catch (Exception e) {
            log.warn("Erreur health check Agoda pour connexion {}: {}", connectionId, e.getMessage());
            return HealthStatus.UNKNOWN;
        }
    }
}
