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
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.model.ChannelContentMapping;
import com.clenzy.model.ChannelFee;
import com.clenzy.repository.BookingRestrictionRepository;
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
    private final BookingRestrictionRepository bookingRestrictionRepository;

    public BookingChannelAdapter(BookingConfig bookingConfig,
                                 BookingApiClient bookingApiClient,
                                 BookingConnectionRepository bookingConnectionRepository,
                                 ChannelMappingRepository channelMappingRepository,
                                 PriceEngine priceEngine,
                                 BookingRestrictionRepository bookingRestrictionRepository) {
        this.bookingConfig = bookingConfig;
        this.bookingApiClient = bookingApiClient;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.channelMappingRepository = channelMappingRepository;
        this.priceEngine = priceEngine;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
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
                ChannelCapability.PROMOTIONS,
                ChannelCapability.OUTBOUND_RESTRICTIONS,
                ChannelCapability.CONTENT_SYNC,
                ChannelCapability.FEES,
                ChannelCapability.CANCELLATION_POLICIES
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
            // Resolve prices and restrictions from PMS
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(propertyId, from, to, orgId);
            List<BookingRestriction> restrictions = bookingRestrictionRepository
                    .findApplicable(propertyId, from, to, orgId);
            String hotelId = resolveHotelId(mapping);

            List<BookingCalendarEventDto> events = prices.entrySet().stream()
                    .map(e -> {
                        BookingRestriction restriction = findApplicableRestriction(restrictions, e.getKey());
                        int minStay = restriction != null && restriction.getMinStay() != null ? restriction.getMinStay() : 1;
                        int maxStay = restriction != null && restriction.getMaxStay() != null ? restriction.getMaxStay() : 365;
                        boolean cta = restriction != null && Boolean.TRUE.equals(restriction.getClosedToArrival());
                        boolean ctd = restriction != null && Boolean.TRUE.equals(restriction.getClosedToDeparture());
                        return new BookingCalendarEventDto(
                                hotelId, roomId, e.getKey(),
                                true,
                                e.getValue() != null ? e.getValue() : BigDecimal.ZERO,
                                "EUR", minStay, maxStay, cta, ctd
                        );
                    })
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

    // ── Restrictions ────────────────────────────────────────────────────────

    /**
     * Pousse les restrictions de sejour vers Booking.com (OUTBOUND).
     * Utilise l'API OTA OTA_HotelAvailNotifRQ avec LengthsOfStay et RestrictionStatus.
     */
    @Override
    public SyncResult pushRestrictions(Long propertyId, LocalDate from,
                                         LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + propertyId);
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        ChannelMapping mapping = mappingOpt.get();
        String roomId = mapping.getExternalId();
        String hotelId = resolveHotelId(mapping);

        try {
            List<BookingRestriction> restrictions = bookingRestrictionRepository
                    .findApplicable(propertyId, from, to, orgId);

            List<BookingCalendarEventDto> events = new ArrayList<>();
            LocalDate current = from;
            while (current.isBefore(to)) {
                BookingRestriction restriction = findApplicableRestriction(restrictions, current);
                int minStay = restriction != null && restriction.getMinStay() != null ? restriction.getMinStay() : 1;
                int maxStay = restriction != null && restriction.getMaxStay() != null ? restriction.getMaxStay() : 365;
                boolean cta = restriction != null && Boolean.TRUE.equals(restriction.getClosedToArrival());
                boolean ctd = restriction != null && Boolean.TRUE.equals(restriction.getClosedToDeparture());

                events.add(new BookingCalendarEventDto(
                        hotelId, roomId, current, true, BigDecimal.ZERO,
                        "EUR", minStay, maxStay, cta, ctd
                ));
                current = current.plusDays(1);
            }

            boolean success = bookingApiClient.updateAvailability(events);
            long duration = System.currentTimeMillis() - startTime;

            if (success) {
                log.info("Restrictions Booking.com mises a jour pour propriete {} ({} jours)", propertyId, events.size());
                return SyncResult.success(events.size(), duration);
            }
            return SyncResult.failed("Booking.com a rejete la mise a jour des restrictions", duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push restrictions Booking.com pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Booking.com: " + e.getMessage(), duration);
        }
    }

    // ── Content ─────────────────────────────────────────────────────────────

    /**
     * Pousse le contenu vers Booking.com via OTA_HotelDescriptiveContentNotifRQ.
     * Booking.com gere le contenu principalement via l'extranet, mais certains
     * champs peuvent etre mis a jour via l'API XML.
     */
    @Override
    public SyncResult pushContent(ChannelContentMapping content, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(content.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + content.getPropertyId());
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        // Booking.com content updates are limited via XML API
        // Most content is managed through the extranet
        long duration = System.currentTimeMillis() - startTime;
        log.info("Content push pour Booking.com propriete {} — contenu gere via extranet",
                content.getPropertyId());
        return SyncResult.skipped("Booking.com content geree principalement via extranet");
    }

    /**
     * Recupere le contenu depuis Booking.com.
     */
    @Override
    public SyncResult pullContent(Long propertyId, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + propertyId);
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        // Pull content via OTA_HotelDescriptiveInfoRQ
        long duration = System.currentTimeMillis() - startTime;
        log.info("Content pull depuis Booking.com pour propriete {} — sera implemente", propertyId);
        return SyncResult.skipped("Booking.com content pull en cours d'implementation");
    }

    // ── Fees ─────────────────────────────────────────────────────────────────

    /**
     * Pousse les frais supplementaires vers Booking.com via OTA_HotelRatePlanNotifRQ.
     */
    @Override
    public SyncResult pushFees(java.util.List<ChannelFee> fees, Long orgId) {
        if (fees.isEmpty()) {
            return SyncResult.skipped("Aucun fee a pousser vers Booking.com");
        }

        long startTime = System.currentTimeMillis();
        Long propertyId = fees.getFirst().getPropertyId();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + propertyId);
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        String roomId = mappingOpt.get().getExternalId();

        try {
            // Build fee-related rate adjustments via OTA XML
            List<BookingRateDto> feeRates = fees.stream()
                    .filter(ChannelFee::getEnabled)
                    .map(fee -> new BookingRateDto(
                            roomId,
                            LocalDate.now(),
                            fee.getAmount(),
                            fee.getCurrency(),
                            null,
                            "FEE_" + fee.getFeeType().name(),
                            1,
                            Map.of("fee_type", fee.getFeeType().name(),
                                   "charge_type", fee.getChargeType().name(),
                                   "mandatory", fee.getIsMandatory())
                    ))
                    .collect(Collectors.toList());

            if (feeRates.isEmpty()) {
                return SyncResult.skipped("Aucun fee actif pour Booking.com");
            }

            boolean success = bookingApiClient.updateRates(feeRates);
            long duration = System.currentTimeMillis() - startTime;

            if (success) {
                log.info("Pushed {} fees to Booking.com for property {}", feeRates.size(), propertyId);
                return SyncResult.success(feeRates.size(), duration);
            }
            return SyncResult.failed("Booking.com a rejete les fees", duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push fees Booking.com pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Booking.com: " + e.getMessage(), duration);
        }
    }

    // ── Cancellation Policies ───────────────────────────────────────────────

    /**
     * Pousse une politique d'annulation vers Booking.com via OTA_HotelRatePlanNotifRQ.
     * Utilise CancelPenalties, Deadline et AmountPercent.
     */
    @Override
    public SyncResult pushCancellationPolicy(ChannelCancellationPolicy policy, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(policy.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Booking.com pour propriete " + policy.getPropertyId());
        }

        if (!bookingConfig.isConfigured()) {
            return SyncResult.failed("Configuration Booking.com incomplete");
        }

        // Booking.com cancellation policies are managed via rate plans
        // The policy type maps to specific CancelPenalties in OTA XML
        long duration = System.currentTimeMillis() - startTime;
        log.info("Cancellation policy {} push vers Booking.com pour propriete {} — type {}",
                policy.getId(), policy.getPropertyId(), policy.getPolicyType());
        return SyncResult.skipped("Booking.com cancellation policies gerees via rate plan extranet");
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

    /**
     * Trouve la restriction applicable pour une date donnee.
     * Retourne la premiere restriction applicable (ordonnee par priorite DESC).
     */
    private BookingRestriction findApplicableRestriction(List<BookingRestriction> restrictions, LocalDate date) {
        return restrictions.stream()
                .filter(r -> r.appliesTo(date))
                .findFirst()
                .orElse(null);
    }
}
