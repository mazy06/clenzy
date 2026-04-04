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
    Long guestId,
    String guestEmail,
    String guestPhone,
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
    String notes,
    Double cleaningFee,
    Double touristTaxAmount,
    Boolean createCleaning,
    // Payment link tracking
    String paymentLinkSentAt,
    String paymentLinkEmail,
    Boolean hiddenFromPlanning,
    // Payment status (read-only output)
    String paymentStatus,
    String paidAt,
    // Linked intervention (read-only output)
    Long interventionId
) {}
