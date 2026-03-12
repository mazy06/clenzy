package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Reponse apres creation d'une reservation PENDING ou CONFIRMED (si autoConfirm).
 */
public record BookingReserveResponseDto(
    String reservationCode,
    String status,
    String propertyName,
    LocalDate checkIn,
    LocalDate checkOut,
    BigDecimal total,
    String currency,
    LocalDateTime expiresAt,
    boolean requiresPayment
) {}
