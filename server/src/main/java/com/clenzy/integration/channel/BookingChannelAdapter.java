package com.clenzy.integration.channel;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingCalendarEventDto;
import com.clenzy.integration.booking.dto.BookingRateDto;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.service.PriceEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Adaptateur ChannelConnector pour Booking.com.
 *
 * Le traitement INBOUND (Booking -> PMS) passe par les
 * Kafka consumers existants (BookingCalendarService, BookingReservationService).
 * Cet adaptateur fournit :
 * - resolveMapping() pour le systeme generique
 * - pushCalendarUpdate() pour le fan-out OUTBOUND avec prix resolus
 * - pushPromotion() pour les promotions Booking.com (Genius, Preferred, etc.)
 * - checkHealth() basee sur la verification des credentials API
 */
@Component
public class BookingChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(BookingChannelAdapter.class);

    private final BookingConfig bookingConfig;
    private final BookingApiClient bookingApiClient;
    private final BookingConnectionRepository bookingConnectionRepository;
    private final ChannelMappingRepository channelMappingRepository;
    private final PriceEngine priceEngine;

    public BookingChannelAdapter(BookingConfig bookingConfig,
                                 BookingApiClient bookingApiClient,
                                 BookingConnectionRepository bookingConnectionRepository,
                                 ChannelMappingRepository channelMappingRepository,
                                 PriceEngine priceEngine) {
        this.bookingConfig = bookingConfig;
        this.bookingApiClient = bookingApiClient;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.channelMappingRepository = channelMappingRepository;
        this.priceEngine = priceEngine;
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
                ChannelCapability.WEBHOOKS,
                ChannelCapability.PROMOTIONS
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.BOOKING, orgId);
    }

    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("BookingChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
    }

    /**
     * Push calendrier vers Booking.com (OUTBOUND).
     * Utilise l'API XML OTA pour pousser disponibilites et tarifs resolus par PriceEngine.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + propertyId);
        }

        ChannelMapping mapping = mappingOpt.get();
        String roomId = mapping.getExternalId();

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        try {
            // Resolve prices from PriceEngine and build calendar events
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(propertyId, from, to, orgId);
            String hotelId = resolveHotelId(mapping);

            List<BookingCalendarEventDto> events = prices.entrySet().stream()
                    .map(e -> new BookingCalendarEventDto(
                            hotelId, roomId, e.getKey(),
                            true, // available
                            e.getValue() != null ? e.getValue() : BigDecimal.ZERO,
                            "EUR", 1, 365, false, false
                    ))
                    .collect(Collectors.toList());

            if (events.isEmpty()) {
                return SyncResult.skipped("Aucun prix a pousser pour propriete " + propertyId);
            }

            // Push availability
            boolean availSuccess = bookingApiClient.updateAvailability(events);

            // Push rates separately
            List<BookingRateDto> rates = events.stream()
                    .filter(e -> e.price() != null && e.price().compareTo(BigDecimal.ZERO) > 0)
                    .map(e -> new BookingRateDto(
                            roomId, e.date(), e.price(), e.currency(),
                            null, "BASE", 1, Map.of()
                    ))
                    .collect(Collectors.toList());

            boolean rateSuccess = rates.isEmpty() || bookingApiClient.updateRates(rates);

            long duration = System.currentTimeMillis() - startTime;

            if (availSuccess && rateSuccess) {
                log.info("Calendrier + tarifs Booking.com mis a jour pour propriete {} ({} jours)",
                        propertyId, events.size());
                return SyncResult.success(events.size(), duration);
            }

            return SyncResult.failed("Echec partiel: avail=" + availSuccess + " rates=" + rateSuccess, duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Booking.com pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Booking.com: " + e.getMessage(), duration);
        }
    }

    /**
     * Pousse une promotion vers Booking.com.
     * Booking.com gere les programmes (Genius, Preferred Partner) via leur extranet,
     * mais certaines promotions (flash sales, early bird) peuvent etre pushees via API XML.
     */
    @Override
    public SyncResult pushPromotion(ChannelPromotion promo, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(promo.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + promo.getPropertyId());
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        String roomId = mappingOpt.get().getExternalId();

        try {
            // For discountable promotions, apply discount as rate override
            if (promo.getDiscountPercentage() != null && promo.getStartDate() != null && promo.getEndDate() != null) {
                Map<LocalDate, BigDecimal> basePrices = priceEngine.resolvePriceRange(
                        promo.getPropertyId(), promo.getStartDate(), promo.getEndDate().plusDays(1), orgId);

                BigDecimal discountMultiplier = BigDecimal.ONE.subtract(
                        promo.getDiscountPercentage().divide(BigDecimal.valueOf(100)));

                List<BookingRateDto> promoRates = basePrices.entrySet().stream()
                        .filter(e -> e.getValue() != null)
                        .map(e -> new BookingRateDto(
                                roomId,
                                e.getKey(),
                                e.getValue().multiply(discountMultiplier),
                                "EUR",
                                null,
                                "PROMO_" + promo.getPromotionType().name(),
                                1,
                                Map.of()
                        ))
                        .collect(Collectors.toList());

                if (!promoRates.isEmpty()) {
                    boolean success = bookingApiClient.updateRates(promoRates);
                    long duration = System.currentTimeMillis() - startTime;
                    if (success) {
                        log.info("Promotion {} pushed to Booking.com ({} days discounted)", promo.getId(), promoRates.size());
                        return SyncResult.success(promoRates.size(), duration);
                    }
                    return SyncResult.failed("Booking.com rejected promotion rates", duration);
                }
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("Promotion {} type {} pour Booking.com — pas de tarifs a modifier",
                    promo.getId(), promo.getPromotionType());
            return SyncResult.skipped("Promotion type " + promo.getPromotionType() + " geree via extranet Booking.com");

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push promotion Booking.com pour propriete {}: {}", promo.getPropertyId(), e.getMessage());
            return SyncResult.failed("Erreur API Booking.com: " + e.getMessage(), duration);
        }
    }

    @Override
    public SyncResult pushReservationUpdate(Long reservationId, Long orgId) {
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

        if (!bookingConfig.isConfigured()) {
            return HealthStatus.UNHEALTHY;
        }

        if (connection.getLastSyncAt() != null
                && connection.getLastSyncAt().isAfter(java.time.LocalDateTime.now().minusHours(1))) {
            return HealthStatus.HEALTHY;
        }

        if (connection.getErrorMessage() != null && !connection.getErrorMessage().isEmpty()) {
            return HealthStatus.DEGRADED;
        }

        return HealthStatus.HEALTHY;
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Resolve hotelId from ChannelMapping externalId.
     * For Booking.com, the externalId is the hotel/room identifier.
     */
    private String resolveHotelId(ChannelMapping mapping) {
        return mapping.getExternalId();
    }
}
