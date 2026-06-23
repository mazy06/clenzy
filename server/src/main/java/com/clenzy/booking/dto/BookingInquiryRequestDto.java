package com.clenzy.booking.dto;

import java.time.LocalDate;

/**
 * Corps d'une demande de réservation (« devis ») soumise depuis le booking engine public
 * (parcours « Demande de devis »). Tous les champs sauf l'email sont optionnels côté serveur.
 */
public record BookingInquiryRequestDto(
    Long propertyId,
    LocalDate checkIn,
    LocalDate checkOut,
    Integer guests,
    String name,
    String email,
    String phone,
    String message
) {}
