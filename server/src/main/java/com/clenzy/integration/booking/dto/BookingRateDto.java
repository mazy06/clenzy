package com.clenzy.integration.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * DTO pour les tarifs Booking.com (rate plans).
 */
public record BookingRateDto(
        String roomId,
        LocalDate date,
        BigDecimal price,
        String currency,
        String rateId,
        String ratePlanCode,
        int availability,
        Map<String, Object> restrictions
) {}
