package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Corps d'achat d'un upsell depuis le booking engine : code de la réservation (résolu + scopé org côté
 * serveur) et {@code returnUrl} optionnel (page de retour du template, validée anti open-redirect).
 */
public record BookingUpsellCheckoutRequest(
    @NotBlank String reservationCode,
    String returnUrl
) {}
