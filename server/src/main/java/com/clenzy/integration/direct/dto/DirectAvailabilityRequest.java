package com.clenzy.integration.direct.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Requete de verification de disponibilite depuis le widget.
 */
public record DirectAvailabilityRequest(
        @NotNull(message = "L'identifiant de la propriete est obligatoire")
        Long propertyId,

        @NotNull(message = "La date de check-in est obligatoire")
        @FutureOrPresent(message = "La date de check-in doit etre dans le futur")
        LocalDate checkIn,

        @NotNull(message = "La date de check-out est obligatoire")
        @Future(message = "La date de check-out doit etre dans le futur")
        LocalDate checkOut,

        @Min(value = 1, message = "Le nombre de voyageurs doit etre au moins 1")
        int numberOfGuests
) {
}
