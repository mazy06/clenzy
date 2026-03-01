package com.clenzy.integration.tripadvisor.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant la disponibilite d'un listing TripAdvisor.
 */
public record TripAdvisorAvailabilityDto(
        String listingId,
        LocalDate date,
        boolean available,
        BigDecimal price,
        String currency,
        int minStay
) {}
