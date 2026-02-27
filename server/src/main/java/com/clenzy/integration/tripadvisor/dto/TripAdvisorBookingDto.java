package com.clenzy.integration.tripadvisor.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation TripAdvisor Vacation Rentals.
 */
public record TripAdvisorBookingDto(
        String bookingId,
        String listingId,
        String guestName,
        String guestEmail,
        LocalDate checkIn,
        LocalDate checkOut,
        BigDecimal totalPrice,
        String currency,
        String status,
        int numberOfGuests
) {}
