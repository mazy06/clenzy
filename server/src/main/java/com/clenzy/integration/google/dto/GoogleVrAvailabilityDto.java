package com.clenzy.integration.google.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant la disponibilite d'un listing Google Vacation Rentals.
 * Mappe vers le format ARI (Availability, Rates, Inventory) de Google.
 */
public record GoogleVrAvailabilityDto(
        String listingId,
        LocalDate date,
        boolean available,
        BigDecimal pricePerNight,
        String currency,
        int minStay,
        int maxStay
) {}
