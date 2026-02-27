package com.clenzy.integration.google.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation Google Vacation Rentals.
 */
public record GoogleVrBookingDto(
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
