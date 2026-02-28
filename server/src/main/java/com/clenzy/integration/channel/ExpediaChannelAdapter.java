package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.dto.ExpediaAvailabilityDto;
import com.clenzy.integration.expedia.model.ExpediaConnection;
import com.clenzy.integration.expedia.repository.ExpediaConnectionRepository;
import com.clenzy.integration.expedia.service.ExpediaApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Adaptateur ChannelConnector pour Expedia/VRBO.
 *
 * Delegue aux services Expedia existants sans les modifier.
 *
 * Le traitement INBOUND (Expedia -> PMS) continue de passer par les
 * Kafka consumers existants (ExpediaCalendarService, ExpediaReservationService).
 * Cet adaptateur fournit principalement :
 * - resolveMapping() pour le systeme generique
 * - pushCalendarUpdate() pour le fan-out OUTBOUND
 * - pushReservationUpdate() pour la confirmation de reservation
 * - checkHealth() basee sur l'etat de la connexion
 */
@Component
public class ExpediaChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(ExpediaChannelAdapter.class);

    private final ExpediaConfig expediaConfig;
    private final ExpediaApiClient expediaApiClient;
    private final ExpediaConnectionRepository expediaConnectionRepository;
    private final ChannelMappingRepository channelMappingRepository;

    public ExpediaChannelAdapter(ExpediaConfig expediaConfig,
                                 ExpediaApiClient expediaApiClient,
                                 ExpediaConnectionRepository expediaConnectionRepository,
                                 ChannelMappingRepository channelMappingRepository) {
        this.expediaConfig = expediaConfig;
        this.expediaApiClient = expediaApiClient;
        this.expediaConnectionRepository = expediaConnectionRepository;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.EXPEDIA;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.VRBO, orgId);
    }

    /**
     * Les events inbound Expedia sont deja traites par les Kafka consumers
     * directs (ExpediaCalendarService, ExpediaReservationService).
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("ExpediaChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
        // Les events Expedia passent par webhook -> Kafka -> consumers dedies
        // Pas de double traitement ici
    }

    /**
     * Push calendrier vers Expedia (OUTBOUND).
     * Convertit les donnees calendrier Clenzy en format Expedia Availability
     * et appelle l'API Expedia pour mettre a jour les disponibilites.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        // Verifier qu'un mapping existe
        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Expedia/VRBO pour propriete " + propertyId);
        }

        if (!expediaConfig.isConfigured()) {
            return SyncResult.skipped("Expedia non configure");
        }

        ChannelMapping mapping = mappingOpt.get();
        String expediaPropertyId = mapping.getExternalId();

        try {
            // Construire les disponibilites a pousser
            // Pour l'instant : marquer les dates comme non disponibles (inventaire = 0)
            // TODO : integrer avec CalendarEngine pour lire l'etat reel du calendrier
            List<ExpediaAvailabilityDto> availabilities = buildAvailabilityUpdates(
                    expediaPropertyId, from, to);

            boolean success = expediaApiClient.updateAvailability(
                    expediaPropertyId, availabilities);

            long duration = System.currentTimeMillis() - startTime;

            if (success) {
                log.info("Push calendrier Expedia OK: propriete {} -> {} ({} jours, {}ms)",
                        propertyId, expediaPropertyId, availabilities.size(), duration);
                return SyncResult.success(availabilities.size(), duration);
            } else {
                return SyncResult.failed("Echec mise a jour disponibilite Expedia pour " +
                        expediaPropertyId, duration);
            }
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Expedia propriete {}: {}",
                    propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Expedia: " + e.getMessage(), duration);
        }
    }

    /**
     * Push reservation vers Expedia (OUTBOUND) — confirmation de reservation.
     */
    @Override
    public SyncResult pushReservationUpdate(Long reservationId, Long orgId) {
        long startTime = System.currentTimeMillis();

        if (!expediaConfig.isConfigured()) {
            return SyncResult.skipped("Expedia non configure");
        }

        // TODO : resoudre le mapping reservation -> Expedia reservation ID
        // Pour l'instant, la confirmation se fait via le propertyId
        log.debug("ExpediaChannelAdapter: push reservation OUTBOUND pour reservation {}",
                reservationId);

        long duration = System.currentTimeMillis() - startTime;
        return SyncResult.skipped(
                "Expedia outbound reservation push sera implemente dans une prochaine iteration");
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        try {
            Optional<ExpediaConnection> connectionOpt = expediaConnectionRepository
                    .findById(connectionId);

            if (connectionOpt.isEmpty()) {
                return HealthStatus.UNKNOWN;
            }

            ExpediaConnection connection = connectionOpt.get();

            return switch (connection.getStatus()) {
                case ACTIVE -> HealthStatus.HEALTHY;
                case INACTIVE -> HealthStatus.DEGRADED;
                case ERROR -> HealthStatus.UNHEALTHY;
            };
        } catch (Exception e) {
            log.error("Erreur health check Expedia connexion {}: {}", connectionId, e.getMessage());
            return HealthStatus.UNKNOWN;
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Construit les mises a jour de disponibilite pour une plage de dates.
     * TODO : integrer avec CalendarEngine pour lire l'etat reel.
     */
    private List<ExpediaAvailabilityDto> buildAvailabilityUpdates(String expediaPropertyId,
                                                                    LocalDate from,
                                                                    LocalDate to) {
        List<ExpediaAvailabilityDto> updates = new ArrayList<>();
        LocalDate current = from;

        while (current.isBefore(to)) {
            updates.add(new ExpediaAvailabilityDto(
                    expediaPropertyId,
                    null,           // roomTypeId — sera resolu depuis le mapping config
                    current,
                    1,              // totalInventoryAvailable — defaut 1 pour location courte duree
                    null,           // ratePlanId
                    BigDecimal.ZERO, // pricePerNight — sera lu depuis CalendarEngine
                    "EUR",
                    1,              // minLOS
                    365,            // maxLOS
                    false,          // closedToArrival
                    false           // closedToDeparture
            ));
            current = current.plusDays(1);
        }

        return updates;
    }
}
