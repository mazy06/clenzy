package com.clenzy.integration.hotelscom.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une mise a jour de disponibilite/tarif pour Hotels.com.
 * Compatible avec le format Expedia Partner Central (EPC).
 */
public record HotelsComAvailabilityDto(
        String propertyId,
        String roomTypeId,
        String ratePlanId,
        LocalDate date,
        boolean available,
        BigDecimal rate,
        String currency,
        int totalInventoryAvailable,
        int minLengthOfStay,
        int maxLengthOfStay,
        boolean closedToArrival,
        boolean closedToDeparture
) {}
