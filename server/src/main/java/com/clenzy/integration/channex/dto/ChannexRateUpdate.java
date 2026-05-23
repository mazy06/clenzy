package com.clenzy.integration.channex.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Update de tarif pour une date donnee sur un rate_plan Channex.
 *
 * @param channexPropertyId       Property ID cote Channex
 * @param channexRatePlanId       Rate plan ID (issu du mapping Clenzy)
 * @param date                    Date concernee
 * @param rate                    Tarif principal (currency: celle de la property)
 * @param minStayThrough          Min stay through (nullable, override le defaut)
 * @param minStayArrival          Min stay arrival (nullable)
 * @param closedToArrival         Si true, pas de check-in autorise ce jour
 * @param closedToDeparture       Si true, pas de check-out autorise ce jour
 */
public record ChannexRateUpdate(
    String channexPropertyId,
    String channexRatePlanId,
    LocalDate date,
    BigDecimal rate,
    Integer minStayThrough,
    Integer minStayArrival,
    Boolean closedToArrival,
    Boolean closedToDeparture
) {
    public ChannexRateUpdate {
        if (rate == null || rate.signum() < 0) {
            throw new IllegalArgumentException("rate must be >= 0, got " + rate);
        }
    }

    /** Update simplifie : juste le tarif sans restrictions. */
    public static ChannexRateUpdate rateOnly(String propertyId, String ratePlanId,
                                              LocalDate date, BigDecimal rate) {
        return new ChannexRateUpdate(propertyId, ratePlanId, date, rate, null, null, null, null);
    }
}
