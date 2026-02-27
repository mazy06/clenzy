package com.clenzy.integration.direct.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resume d'une propriete expose par le widget de reservation directe.
 * Contient les informations publiques necessaires a l'affichage.
 */
public record DirectPropertySummaryDto(
        Long propertyId,
        String name,
        String description,
        String propertyType,
        int maxGuests,
        int bedrooms,
        int bathrooms,
        BigDecimal basePrice,
        String currency,
        List<String> photos,
        List<String> amenities,
        String address,
        String city,
        String country,
        double latitude,
        double longitude,
        double averageRating,
        int numberOfReviews
) {
}
