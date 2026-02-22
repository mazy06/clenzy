package com.clenzy.dto;

/**
 * DTO pour les reservations (sejours voyageurs).
 * Utilise en entree (create/update) et en sortie (lecture).
 */
public record ReservationDto(
    Long id,
    Long propertyId,
    String propertyName,
    String guestName,
    Integer guestCount,
    String checkIn,
    String checkOut,
    String checkInTime,
    String checkOutTime,
    String status,
    String source,
    String sourceName,
    Double totalPrice,
    String confirmationCode,
    String notes
) {}
