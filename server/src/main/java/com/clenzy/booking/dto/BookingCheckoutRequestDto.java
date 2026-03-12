package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Requete pour creer une Stripe Checkout Session a partir d'un code de reservation.
 */
public record BookingCheckoutRequestDto(
    @NotBlank(message = "reservationCode est obligatoire")
    String reservationCode
) {}
