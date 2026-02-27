package com.clenzy.dto.rate;

import com.clenzy.integration.channel.ChannelName;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Vue calendrier tarifaire pour une date.
 * Affiche le prix de base et les prix derives par channel.
 */
public record RateCalendarDto(
    Long propertyId,
    LocalDate date,
    BigDecimal basePrice,
    Map<ChannelName, BigDecimal> channelPrices,
    String appliedRatePlan,
    String appliedYieldRule,
    BigDecimal occupancyAdjustment,
    BigDecimal losDiscount
) {}
