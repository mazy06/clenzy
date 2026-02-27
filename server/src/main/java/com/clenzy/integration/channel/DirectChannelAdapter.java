package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour le canal Direct Booking.
 *
 * Contrairement aux OTAs (Airbnb, Booking), le canal Direct est interne :
 * il n'y a pas d'API externe a appeler. Les reservations sont creees
 * directement dans le PMS via le widget embarque.
 *
 * Ce adaptateur permet au systeme generique de channel management
 * de traiter le Direct Booking de maniere uniforme :
 * - resolveMapping() : retourne un mapping virtuel si le direct booking est active
 * - pushCalendarUpdate() : no-op (le calendrier est deja local)
 * - checkHealth() : toujours HEALTHY (pas de dependance externe)
 */
@Component
public class DirectChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(DirectChannelAdapter.class);

    private final DirectBookingConfig config;
    private final DirectBookingConfigRepository configRepository;

    public DirectChannelAdapter(DirectBookingConfig config,
                                 DirectBookingConfigRepository configRepository) {
        this.config = config;
        this.configRepository = configRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.DIRECT;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_CALENDAR
        );
    }

    /**
     * Resout le mapping pour une propriete avec direct booking active.
     * Le canal Direct n'a pas de ChannelConnection/ChannelMapping en base :
     * il retourne un mapping virtuel construit a la volee.
     */
    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        if (!config.isEnabled()) {
            return Optional.empty();
        }

        Optional<DirectBookingConfiguration> dbConfig =
                configRepository.findEnabledByPropertyId(propertyId, orgId);

        if (dbConfig.isEmpty()) {
            return Optional.empty();
        }

        // Creer un mapping virtuel (non persiste) pour le systeme generique
        ChannelMapping virtualMapping = new ChannelMapping();
        virtualMapping.setInternalId(propertyId);
        virtualMapping.setExternalId("direct-" + propertyId);
        virtualMapping.setEntityType("PROPERTY");
        virtualMapping.setOrganizationId(orgId);
        virtualMapping.setSyncEnabled(true);

        return Optional.of(virtualMapping);
    }

    /**
     * Les events inbound du canal Direct sont traites directement par
     * DirectBookingService (pas de webhook externe, pas de Kafka).
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("DirectChannelAdapter.handleInboundEvent: type={} (traite directement par DirectBookingService)",
                eventType);
        // Les reservations directes sont creees via DirectBookingService
        // sans passer par le pipeline generique inbound
    }

    /**
     * Push calendrier : no-op pour le canal Direct.
     * Le calendrier est deja dans la base locale, le widget le lit directement.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        log.debug("DirectChannelAdapter: push calendrier no-op (calendrier deja local, propriete {})",
                propertyId);
        return SyncResult.skipped("Canal Direct : le calendrier est deja local");
    }

    /**
     * Push reservation : no-op pour le canal Direct.
     * Les reservations sont directement dans la base.
     */
    @Override
    public SyncResult pushReservationUpdate(Long reservationId, Long orgId) {
        log.debug("DirectChannelAdapter: push reservation no-op (reservation deja locale, id {})",
                reservationId);
        return SyncResult.skipped("Canal Direct : la reservation est deja locale");
    }

    /**
     * Le canal Direct est toujours HEALTHY car il n'a aucune dependance externe.
     */
    @Override
    public HealthStatus checkHealth(Long connectionId) {
        return HealthStatus.HEALTHY;
    }
}
