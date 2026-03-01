package com.clenzy.integration.tripadvisor.dto;

import java.util.List;

/**
 * DTO representant un listing TripAdvisor Vacation Rentals.
 */
public record TripAdvisorListingDto(
        String listingId,
        String partnerListingId,
        String propertyName,
        String description,
        String propertyType,
        int maxGuests,
        int bedrooms,
        int bathrooms,
        List<String> amenities
) {}
