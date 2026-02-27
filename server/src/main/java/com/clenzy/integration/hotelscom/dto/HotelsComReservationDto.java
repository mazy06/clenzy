package com.clenzy.integration.hotelscom.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant une reservation Hotels.com (Expedia Group).
 * Structure similaire a l'API Expedia Partner Central.
 */
public record HotelsComReservationDto(
        String confirmationNumber,
        String propertyId,
        String roomTypeId,
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
        int numberOfRooms,
        String specialRequests,
        String source
) {}
