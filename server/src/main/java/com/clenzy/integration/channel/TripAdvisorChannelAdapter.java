package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.service.TripAdvisorSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour TripAdvisor Vacation Rentals.
 *
 * TripAdvisor supporte les webhooks pour les reservations entrantes
 * et un mode push pour les disponibilites sortantes.
 *
 * Capacites :
 * - OUTBOUND_CALENDAR : push des disponibilites vers TripAdvisor
 * - INBOUND_RESERVATIONS : reception de reservations via webhook
 * - WEBHOOKS : TripAdvisor envoie des notifications temps reel
 *
 * Delegue aux services TripAdvisor existants sans les modifier.
 */
@Component
public class TripAdvisorChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(TripAdvisorChannelAdapter.class);

    private final TripAdvisorConfig config;
    private final TripAdvisorSyncService syncService;
    private final ChannelMappingRepository channelMappingRepository;

    public TripAdvisorChannelAdapter(TripAdvisorConfig config,
                                      TripAdvisorSyncService syncService,
                                      ChannelMappingRepository channelMappingRepository) {
        this.config = config;
        this.syncService = syncService;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.TRIPADVISOR;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.TRIPADVISOR, orgId);
    }

    /**
     * Traite un evenement inbound TripAdvisor (webhook ou resultat de poll).
     * Les webhooks arrivent via TripAdvisorWebhookController et sont
     * delegues a TripAdvisorSyncService.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("TripAdvisorChannelAdapter.handleInboundEvent: type={}", eventType);
        syncService.handleBookingWebhook(eventType, data, orgId);
    }

    /**
     * Push calendrier (disponibilites) vers TripAdvisor.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping TripAdvisor pour propriete " + propertyId);
        }

        if (!config.isConfigured()) {
            return SyncResult.skipped("TripAdvisor non configure");
        }

        final long startMs = System.currentTimeMillis();

        try {
            int pushed = syncService.pushAvailability(orgId, from, to);
            final long durationMs = System.currentTimeMillis() - startMs;

            if (pushed < 0) {
                return SyncResult.skipped("Pas de connexion TripAdvisor active pour org " + orgId);
            }

            return SyncResult.success(pushed, durationMs);
        } catch (Exception e) {
            final long durationMs = System.currentTimeMillis() - startMs;
            log.error("Erreur push calendrier TripAdvisor pour propriete {} (org={}): {}",
                    propertyId, orgId, e.getMessage(), e);
            return SyncResult.failed("Erreur TripAdvisor: " + e.getMessage(), durationMs);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        // TODO : verifier la connectivite avec l'API TripAdvisor
        return HealthStatus.UNKNOWN;
    }
}
