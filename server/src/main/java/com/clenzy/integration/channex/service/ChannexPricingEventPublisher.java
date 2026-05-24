package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.event.ChannexPricingSettingsChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Publisher central pour les events pricing-changed — Phase 5 audit O3.
 *
 * <p>Helper a injecter dans les services Clenzy qui modifient des entites
 * tarifaires (RatePlan, OccupancyPricing, LengthOfStayDiscount, Property.nightlyPrice)
 * pour declencher un push auto vers Channex via le listener
 * {@link ChannexPricingSettingsAutoPushListener}.</p>
 *
 * <p><b>Usage type</b> dans un service qui modifie un RatePlan(WEEKEND) :</p>
 * <pre>{@code
 * @Transactional
 * public void updateWeekendRate(Long propertyId, Long orgId, BigDecimal price) {
 *     // ... modifs DB ...
 *     channexPricingEventPublisher.publish(propertyId, orgId, "WEEKEND_RATE_UPDATED");
 * }
 * }</pre>
 *
 * <p>L'event est publie maintenant mais le listener est @Async → le push HTTP
 * est decouple du commit de la transaction caller.</p>
 */
@Component
public class ChannexPricingEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ChannexPricingEventPublisher.class);

    private final ApplicationEventPublisher eventPublisher;

    public ChannexPricingEventPublisher(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * Publie un event qui declenchera le push pricing settings vers Channex
     * de maniere asynchrone.
     *
     * @param clenzyPropertyId property dont les settings ont change
     * @param organizationId   tenant (requis car le listener est async hors TenantContext)
     * @param source           label pour les logs (ex: "WEEKEND_RATE_UPDATED",
     *                         "OCCUPANCY_PRICING_UPDATED", "LOS_DISCOUNT_UPDATED")
     */
    public void publish(Long clenzyPropertyId, Long organizationId, String source) {
        if (clenzyPropertyId == null || organizationId == null) {
            log.warn("ChannexPricingEvent: publish skip (property ou org null, source={})", source);
            return;
        }
        eventPublisher.publishEvent(new ChannexPricingSettingsChangedEvent(
            clenzyPropertyId, organizationId, source != null ? source : "UNKNOWN"));
    }
}
