package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Confirmation post-paiement affichee au guest.
 */
public record BookingConfirmationDto(
    String reservationCode,
    String status,
    String paymentStatus,
    String propertyName,
    String propertyCity,
    LocalDate checkIn,
    LocalDate checkOut,
    int nights,
    int guests,
    BigDecimal subtotal,
    BigDecimal cleaningFee,
    BigDecimal touristTax,
    BigDecimal total,
    String currency,
    String guestName,
    String guestEmail,
    String checkInTime,
    String checkOutTime
) {}
