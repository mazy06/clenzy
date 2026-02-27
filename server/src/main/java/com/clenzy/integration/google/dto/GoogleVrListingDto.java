package com.clenzy.integration.google.dto;

/**
 * DTO representant un listing Google Vacation Rentals.
 * Mappe vers le format Hotel Center Listing Feed.
 */
public record GoogleVrListingDto(
        String listingId,
        String partnerListingId,
        String propertyName,
        String address,
        double latitude,
        double longitude,
        String propertyType,
        int maxOccupancy,
        int bedrooms,
        int bathrooms
) {}
