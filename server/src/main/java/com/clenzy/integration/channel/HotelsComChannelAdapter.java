package com.clenzy.integration.channel;

import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import com.clenzy.integration.hotelscom.service.HotelsComApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Hotels.com (Expedia Group).
 *
 * Delegue aux services Hotels.com existants sans les modifier.
 *
 * Hotels.com utilise l'API Expedia Partner Central avec authentification
 * Basic Auth. Les reservations sont recuperees par polling periodique.
 *
 * Capacites :
 * - OUTBOUND_CALENDAR : push de disponibilite/tarifs vers Hotels.com/EPC
 * - INBOUND_RESERVATIONS : reception de reservations par polling
 * - POLLING : pas de webhooks temps reel
 */
@Component
public class HotelsComChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(HotelsComChannelAdapter.class);

    private final HotelsComConfig hotelsComConfig;
    private final HotelsComConnectionRepository hotelsComConnectionRepository;
    private final HotelsComApiClient hotelsComApiClient;
    private final ChannelMappingRepository channelMappingRepository;

    public HotelsComChannelAdapter(HotelsComConfig hotelsComConfig,
                                   HotelsComConnectionRepository hotelsComConnectionRepository,
                                   HotelsComApiClient hotelsComApiClient,
                                   ChannelMappingRepository channelMappingRepository) {
        this.hotelsComConfig = hotelsComConfig;
        this.hotelsComConnectionRepository = hotelsComConnectionRepository;
        this.hotelsComApiClient = hotelsComApiClient;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.HOTELS_COM;
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
                propertyId, ChannelName.HOTELS_COM, orgId);
    }

    /**
     * Les events inbound Hotels.com sont traites par le polling scheduler.
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("HotelsComChannelAdapter.handleInboundEvent: type={} (delegue au polling scheduler)",
                eventType);
        // Les events Hotels.com passent par polling → HotelsComSyncService
    }

    /**
     * Push calendrier vers Hotels.com (OUTBOUND).
     * Utilise l'API Expedia Partner Central pour mettre a jour la disponibilite.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Hotels.com pour propriete " + propertyId);
        }

        if (!hotelsComConfig.isConfigured()) {
            return SyncResult.skipped("Configuration Hotels.com incomplete");
        }

        long startTime = System.currentTimeMillis();

        try {
            String externalPropertyId = mapping.get().getExternalId();

            // TODO : construire la liste de disponibilite depuis le CalendarEngine
            // List<HotelsComAvailabilityDto> availability = buildAvailabilityFromCalendar(propertyId, from, to, orgId);
            // hotelsComApiClient.updateAvailability(externalPropertyId, availability);

            log.debug("HotelsComChannelAdapter: push calendrier OUTBOUND pour propriete {} -> Hotels.com {}",
                    propertyId, externalPropertyId);

            long duration = System.currentTimeMillis() - startTime;
            return SyncResult.skipped("Hotels.com outbound calendar push sera implemente en phase suivante");

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Hotels.com pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Push calendrier Hotels.com echoue: " + e.getMessage(), duration);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        try {
            HotelsComConnection connection = hotelsComConnectionRepository.findById(connectionId).orElse(null);
            if (connection == null) {
                return HealthStatus.UNKNOWN;
            }

            return switch (connection.getStatus()) {
                case ACTIVE -> HealthStatus.HEALTHY;
                case ERROR -> HealthStatus.UNHEALTHY;
                case INACTIVE -> HealthStatus.DEGRADED;
            };
        } catch (Exception e) {
            log.warn("Erreur health check Hotels.com pour connexion {}: {}", connectionId, e.getMessage());
            return HealthStatus.UNKNOWN;
        }
    }
}
