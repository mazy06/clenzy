package com.clenzy.integration.channel;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.homeaway.service.HomeAwayApiClient;
import com.clenzy.integration.homeaway.service.HomeAwayOAuthService;
import com.clenzy.integration.homeaway.service.HomeAwaySyncService;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour HomeAway/Abritel.
 *
 * Delegue aux services HomeAway existants sans les modifier.
 *
 * HomeAway utilise OAuth 2.0 pour l'authentification et supporte
 * a la fois les webhooks temps reel et le polling periodique.
 *
 * Capacites :
 * - INBOUND_CALENDAR : reception de mises a jour de disponibilite depuis HomeAway
 * - OUTBOUND_CALENDAR : push de disponibilite/tarifs vers HomeAway
 * - INBOUND_RESERVATIONS : reception de reservations via webhooks et polling
 * - WEBHOOKS : notifications temps reel depuis HomeAway
 * - OAUTH : authentification OAuth 2.0
 */
@Component
public class HomeAwayChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(HomeAwayChannelAdapter.class);

    private final HomeAwayConfig homeAwayConfig;
    private final HomeAwayConnectionRepository homeAwayConnectionRepository;
    private final HomeAwayApiClient homeAwayApiClient;
    private final HomeAwayOAuthService homeAwayOAuthService;
    private final HomeAwaySyncService homeAwaySyncService;
    private final ChannelMappingRepository channelMappingRepository;

    public HomeAwayChannelAdapter(HomeAwayConfig homeAwayConfig,
                                  HomeAwayConnectionRepository homeAwayConnectionRepository,
                                  HomeAwayApiClient homeAwayApiClient,
                                  HomeAwayOAuthService homeAwayOAuthService,
                                  HomeAwaySyncService homeAwaySyncService,
                                  ChannelMappingRepository channelMappingRepository) {
        this.homeAwayConfig = homeAwayConfig;
        this.homeAwayConnectionRepository = homeAwayConnectionRepository;
        this.homeAwayApiClient = homeAwayApiClient;
        this.homeAwayOAuthService = homeAwayOAuthService;
        this.homeAwaySyncService = homeAwaySyncService;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.HOMEAWAY;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.HOMEAWAY, orgId);
    }

    /**
     * Traite un evenement inbound HomeAway.
     * Les webhooks sont deja routes par HomeAwayWebhookController vers HomeAwaySyncService.
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("HomeAwayChannelAdapter.handleInboundEvent: type={}, orgId={}", eventType, orgId);

        switch (eventType) {
            case "reservation.created" -> homeAwaySyncService.handleReservationCreated(data, orgId);
            case "reservation.updated" -> homeAwaySyncService.handleReservationUpdated(data, orgId);
            case "reservation.cancelled" -> homeAwaySyncService.handleReservationCancelled(data, orgId);
            case "availability.updated" -> homeAwaySyncService.handleAvailabilityUpdate(data, orgId);
            default -> log.warn("Type d'evenement HomeAway inconnu: {}", eventType);
        }
    }

    /**
     * Push calendrier vers HomeAway (OUTBOUND).
     * Utilise l'API HomeAway pour mettre a jour la disponibilite.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping HomeAway pour propriete " + propertyId);
        }

        if (!homeAwayConfig.isConfigured()) {
            return SyncResult.skipped("Configuration HomeAway incomplete");
        }

        if (!homeAwayOAuthService.isConnected(orgId)) {
            return SyncResult.skipped("Pas de connexion OAuth HomeAway active pour org " + orgId);
        }

        long startTime = System.currentTimeMillis();

        try {
            String externalListingId = mapping.get().getExternalId();
            String accessToken = homeAwayOAuthService.getValidAccessToken(orgId);

            // TODO : construire la liste de disponibilite depuis le CalendarEngine
            // List<HomeAwayAvailabilityDto> availability = buildAvailabilityFromCalendar(propertyId, from, to, orgId);
            // homeAwayApiClient.updateAvailability(externalListingId, availability, accessToken);

            log.debug("HomeAwayChannelAdapter: push calendrier OUTBOUND pour propriete {} -> HomeAway {}",
                    propertyId, externalListingId);

            long duration = System.currentTimeMillis() - startTime;
            return SyncResult.skipped("HomeAway outbound calendar push sera implemente en phase suivante");

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier HomeAway pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Push calendrier HomeAway echoue: " + e.getMessage(), duration);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        try {
            HomeAwayConnection connection = homeAwayConnectionRepository.findById(connectionId).orElse(null);
            if (connection == null) {
                return HealthStatus.UNKNOWN;
            }

            // Verifier le statut de la connexion et l'expiration du token
            if (!connection.isActive()) {
                return HealthStatus.UNHEALTHY;
            }

            if (connection.isTokenExpired()) {
                return HealthStatus.DEGRADED;
            }

            return HealthStatus.HEALTHY;

        } catch (Exception e) {
            log.warn("Erreur health check HomeAway pour connexion {}: {}", connectionId, e.getMessage());
            return HealthStatus.UNKNOWN;
        }
    }
}
