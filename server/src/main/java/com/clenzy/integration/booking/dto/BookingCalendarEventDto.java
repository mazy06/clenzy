package com.clenzy.integration.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO pour les evenements de synchronisation calendrier entre Clenzy et Booking.com.
 */
public record BookingCalendarEventDto(
        String hotelId,
        String roomId,
        LocalDate date,
        boolean available,
        BigDecimal price,
        String currency,
        int minStay,
        int maxStay,
        boolean closedOnArrival,
        boolean closedOnDeparture
) {}
