package com.clenzy.integration.channel;

import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Airbnb.
 *
 * Delegue aux services Airbnb existants sans les modifier.
 *
 * Le traitement INBOUND (Airbnb → PMS) continue de passer par les
 * Kafka consumers existants (AirbnbCalendarService, AirbnbReservationService).
 * Ce adaptateur fournit principalement :
 * - resolveMapping() pour le systeme generique
 * - pushCalendarUpdate() pour le fan-out OUTBOUND (TODO G10+)
 * - checkHealth() basee sur l'AirbnbOAuthService
 */
@Component
public class AirbnbChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(AirbnbChannelAdapter.class);

    private final AirbnbOAuthService airbnbOAuthService;
    private final ChannelMappingRepository channelMappingRepository;

    public AirbnbChannelAdapter(AirbnbOAuthService airbnbOAuthService,
                                ChannelMappingRepository channelMappingRepository) {
        this.airbnbOAuthService = airbnbOAuthService;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.AIRBNB;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH,
                ChannelCapability.MESSAGING
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.AIRBNB, orgId);
    }

    /**
     * Les events inbound Airbnb sont deja traites par les Kafka consumers
     * directs (AirbnbCalendarService, AirbnbReservationService).
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("AirbnbChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
        // Les events Airbnb passent par webhook → Kafka → consumers dédiés
        // Pas de double traitement ici
    }

    /**
     * Push calendrier vers Airbnb (OUTBOUND).
     * TODO G10+ : implementer l'appel API Airbnb pour pousser disponibilite/prix.
     * Pour l'instant : retourne SKIPPED.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        // Verifier qu'un mapping existe
        Optional<ChannelMapping> mapping = resolveMapping(propertyId, orgId);
        if (mapping.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + propertyId);
        }

        // TODO G10+ : appeler l'API Airbnb Calendar Update
        // AirbnbCalendarUpdateRequest req = buildCalendarUpdateRequest(mapping.get(), from, to);
        // airbnbApiClient.updateCalendar(req);

        log.debug("AirbnbChannelAdapter: push calendrier OUTBOUND pas encore implemente " +
                "(propriete {} → listing {})", propertyId, mapping.get().getExternalId());

        return SyncResult.skipped("Airbnb outbound calendar push sera implemente en G10+");
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        // TODO : verifier le statut OAuth de la connexion
        return HealthStatus.UNKNOWN;
    }
}
