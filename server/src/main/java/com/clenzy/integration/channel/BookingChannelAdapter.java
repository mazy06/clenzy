package com.clenzy.integration.channel;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingCalendarEventDto;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Booking.com.
 *
 * Delegue aux services Booking existants sans les modifier.
 *
 * Le traitement INBOUND (Booking → PMS) passe par les
 * Kafka consumers existants (BookingCalendarService, BookingReservationService).
 * Cet adaptateur fournit principalement :
 * - resolveMapping() pour le systeme generique
 * - pushCalendarUpdate() pour le fan-out OUTBOUND
 * - checkHealth() basee sur la verification des credentials API
 */
@Component
public class BookingChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(BookingChannelAdapter.class);

    private final BookingConfig bookingConfig;
    private final BookingApiClient bookingApiClient;
    private final BookingConnectionRepository bookingConnectionRepository;
    private final ChannelMappingRepository channelMappingRepository;

    public BookingChannelAdapter(BookingConfig bookingConfig,
                                 BookingApiClient bookingApiClient,
                                 BookingConnectionRepository bookingConnectionRepository,
                                 ChannelMappingRepository channelMappingRepository) {
        this.bookingConfig = bookingConfig;
        this.bookingApiClient = bookingApiClient;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.BOOKING;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.BOOKING, orgId);
    }

    /**
     * Les events inbound Booking.com sont traites par les Kafka consumers
     * directs (BookingCalendarService, BookingReservationService).
     * Ce handler est un point d'entree alternatif pour les appels programmatiques.
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("BookingChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
        // Les events Booking.com passent par webhook → Kafka → consumers dedies
        // Pas de double traitement ici
    }

    /**
     * Push calendrier vers Booking.com (OUTBOUND).
     * Utilise l'API XML OTA pour pousser les disponibilites.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        // Verifier qu'un mapping existe
        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + propertyId);
        }

        ChannelMapping mapping = mappingOpt.get();
        String roomId = mapping.getExternalId();

        // Verifier que la configuration est complete
        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        try {
            // Construire les evenements calendrier a pousser
            // TODO : lire les donnees du CalendarEngine pour construire les DTOs
            List<BookingCalendarEventDto> events = buildCalendarEvents(mapping, from, to);

            boolean success = bookingApiClient.updateAvailability(events);
            long duration = System.currentTimeMillis() - startTime;

            if (success) {
                log.info("Calendrier Booking.com mis a jour pour propriete {} (room {}) [{}, {})",
                        propertyId, roomId, from, to);
                return SyncResult.success(events.size(), duration);
            }

            return SyncResult.failed("Echec mise a jour calendrier Booking.com pour room " + roomId, duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Booking.com pour propriete {} (room {}): {}",
                    propertyId, roomId, e.getMessage());
            return SyncResult.failed("Erreur API Booking.com: " + e.getMessage(), duration);
        }
    }

    @Override
    public SyncResult pushReservationUpdate(Long reservationId, Long orgId) {
        // Booking.com gere les reservations de son cote
        // Le PMS ne pousse pas de modifications de reservation vers Booking.com
        // sauf pour les acknowledgements (geres par BookingSyncScheduler)
        return SyncResult.skipped("Booking.com gere les reservations — pas de push OUTBOUND");
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        Optional<BookingConnection> connectionOpt = bookingConnectionRepository.findById(connectionId);

        if (connectionOpt.isEmpty()) {
            return HealthStatus.UNKNOWN;
        }

        BookingConnection connection = connectionOpt.get();

        if (!connection.isActive()) {
            return HealthStatus.UNHEALTHY;
        }

        // Verifier que la configuration est valide
        if (!bookingConfig.isConfigured()) {
            return HealthStatus.UNHEALTHY;
        }

        // Verifier si la derniere synchro est recente (< 1h)
        if (connection.getLastSyncAt() != null
                && connection.getLastSyncAt().isAfter(java.time.LocalDateTime.now().minusHours(1))) {
            return HealthStatus.HEALTHY;
        }

        // Si pas de synchro recente mais connexion active : degrade
        if (connection.getErrorMessage() != null && !connection.getErrorMessage().isEmpty()) {
            return HealthStatus.DEGRADED;
        }

        return HealthStatus.HEALTHY;
    }

    /**
     * Construit les evenements calendrier a pousser vers Booking.com.
     * TODO : lire les donnees reelles du CalendarEngine.
     */
    private List<BookingCalendarEventDto> buildCalendarEvents(ChannelMapping mapping,
                                                               LocalDate from, LocalDate to) {
        // TODO : charger les donnees depuis CalendarEngine et construire les DTOs
        // Pour l'instant : retourne une liste vide
        log.debug("Construction evenements calendrier Booking.com pour room {} [{}, {}) (a implementer)",
                mapping.getExternalId(), from, to);
        return List.of();
    }
}
