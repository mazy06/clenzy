package com.clenzy.integration.agoda.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une mise a jour de disponibilite/tarif pour Agoda.
 */
public record AgodaAvailabilityDto(
        String propertyId,
        String roomTypeId,
        LocalDate date,
        boolean available,
        BigDecimal price,
        String currency,
        int allotment,
        int minStay,
        int maxStay,
        boolean closedToArrival,
        boolean closedToDeparture
) {}
