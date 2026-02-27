package com.clenzy.integration.homeaway.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une mise a jour de disponibilite/tarif pour HomeAway/Abritel.
 */
public record HomeAwayAvailabilityDto(
        String listingId,
        LocalDate date,
        boolean available,
        BigDecimal nightlyRate,
        String currency,
        int minStay,
        int maxStay,
        boolean closedToArrival,
        boolean closedToDeparture,
        String changeoverDay
) {}
