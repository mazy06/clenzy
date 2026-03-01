package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.service.GoogleVrSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Google Vacation Rentals.
 *
 * Google fonctionne principalement en mode push pour les listings et ARI
 * (Availability, Rates, Inventory) et en mode pull pour les reservations.
 *
 * Capacites :
 * - OUTBOUND_CALENDAR : push des disponibilites/tarifs vers Google Hotel Center
 * - INBOUND_RESERVATIONS : pull des reservations depuis Google
 * - POLLING : pas de webhooks natifs, les reservations sont recuperees par polling
 *
 * Delegue aux services Google VR existants sans les modifier.
 */
@Component
public class GoogleVacationRentalsChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(GoogleVacationRentalsChannelAdapter.class);

    private final GoogleVacationRentalsConfig config;
    private final GoogleVrSyncService syncService;
    private final ChannelMappingRepository channelMappingRepository;

    public GoogleVacationRentalsChannelAdapter(GoogleVacationRentalsConfig config,
                                                GoogleVrSyncService syncService,
                                                ChannelMappingRepository channelMappingRepository) {
        this.config = config;
        this.syncService = syncService;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.GOOGLE_VACATION_RENTALS;
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
                propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId);
    }

    /**
     * Traite un evenement inbound Google VR (resultat de poll).
     * Les reservations Google sont recuperees par polling periodique
     * (pas de webhook natif).
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("GoogleVacationRentalsChannelAdapter.handleInboundEvent: type={}", eventType);

        if ("google_vr.bookings.poll".equals(eventType)) {
            syncService.pullBookings(orgId);
        }
    }

    /**
     * Push calendrier (disponibilites et tarifs) vers Google Hotel Center.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Google VR pour propriete " + propertyId);
        }

        if (!config.isConfigured()) {
            return SyncResult.skipped("Google Vacation Rentals non configure");
        }

        final long startMs = System.currentTimeMillis();

        try {
            int pushed = syncService.pushAvailabilityAndRates(orgId, from, to);
            final long durationMs = System.currentTimeMillis() - startMs;

            if (pushed < 0) {
                return SyncResult.skipped("Pas de connexion Google VR active pour org " + orgId);
            }

            return SyncResult.success(pushed, durationMs);
        } catch (Exception e) {
            final long durationMs = System.currentTimeMillis() - startMs;
            log.error("Erreur push calendrier Google VR pour propriete {} (org={}): {}",
                    propertyId, orgId, e.getMessage(), e);
            return SyncResult.failed("Erreur Google VR: " + e.getMessage(), durationMs);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        // TODO : verifier la connectivite avec l'API Google Travel Partner
        return HealthStatus.UNKNOWN;
    }
}
