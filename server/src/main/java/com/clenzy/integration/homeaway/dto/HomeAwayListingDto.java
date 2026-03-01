package com.clenzy.integration.homeaway.dto;

import java.math.BigDecimal;

/**
 * DTO representant un listing HomeAway/Abritel.
 */
public record HomeAwayListingDto(
        String listingId,
        String name,
        String description,
        String propertyType,
        int bedrooms,
        int bathrooms,
        int maxGuests,
        String address,
        String city,
        String country,
        BigDecimal baseRate,
        String currency,
        String status
) {}
