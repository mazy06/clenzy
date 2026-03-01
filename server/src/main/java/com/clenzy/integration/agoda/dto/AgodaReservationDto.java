package com.clenzy.integration.agoda.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation Agoda recue via l'API Supply.
 */
public record AgodaReservationDto(
        String bookingId,
        String propertyId,
        String roomTypeId,
        String guestName,
        String guestEmail,
        LocalDate checkIn,
        LocalDate checkOut,
        String status,
        BigDecimal totalAmount,
        String currency,
        int numberOfGuests,
        String specialRequests
) {}
