package com.clenzy.integration.homeaway.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation HomeAway/Abritel recue via l'API ou webhook.
 */
public record HomeAwayReservationDto(
        String reservationId,
        String listingId,
        String guestFirstName,
        String guestLastName,
        String guestEmail,
        String guestPhone,
        LocalDate checkIn,
        LocalDate checkOut,
        String status,
        BigDecimal totalAmount,
        String currency,
        int numberOfGuests,
        int numberOfAdults,
        int numberOfChildren,
        String specialRequests
) {}
