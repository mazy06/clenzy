package com.clenzy.booking.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Requête d'annulation self-service par le voyageur (CLZ Domaine 2).
 * Authentification : code de confirmation (path) + email (ici). Le motif est optionnel
 * (utilisé pour l'audit lors de l'annulation effective ; ignoré pour l'aperçu).
 */
public record BookingCancellationRequest(
        @NotBlank @Email String email,
        String reason
) {}
