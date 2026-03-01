package com.clenzy.integration.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation Booking.com recue via l'API XML ou un webhook.
 */
public record BookingReservationDto(
        String reservationId,
        String hotelId,
        String roomId,
        String guestName,
        String guestEmail,
        String guestPhone,
        LocalDate checkIn,
        LocalDate checkOut,
        String status,
        BigDecimal totalPrice,
        String currency,
        int numberOfGuests,
        String specialRequests,
        String channelReferenceId,
        String bookerCountry,
        String createdAt
) {}
