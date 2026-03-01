package com.clenzy.integration.direct.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Reponse de disponibilite retournee au widget.
 */
public record DirectAvailabilityResponse(
        boolean available,
        Long propertyId,
        BigDecimal totalPrice,
        BigDecimal pricePerNight,
        String currency,
        int nights,
        int minStay,
        int maxStay,
        List<ExtraService> extras
) {

    /**
     * Service supplementaire optionnel propose avec la reservation.
     */
    public record ExtraService(
            String name,
            BigDecimal price,
            String description,
            boolean optional
    ) {
    }

    public static DirectAvailabilityResponse unavailable(Long propertyId, String currency) {
        return new DirectAvailabilityResponse(false, propertyId, BigDecimal.ZERO,
                BigDecimal.ZERO, currency, 0, 0, 0, List.of());
    }
}
