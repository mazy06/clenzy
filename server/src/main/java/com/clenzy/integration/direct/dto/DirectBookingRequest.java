package com.clenzy.integration.direct.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Requete de reservation directe depuis le widget.
 */
public record DirectBookingRequest(
        @NotNull(message = "L'identifiant de la propriete est obligatoire")
        Long propertyId,

        @NotNull(message = "La date de check-in est obligatoire")
        @FutureOrPresent(message = "La date de check-in doit etre dans le futur")
        LocalDate checkIn,

        @NotNull(message = "La date de check-out est obligatoire")
        @Future(message = "La date de check-out doit etre dans le futur")
        LocalDate checkOut,

        @NotBlank(message = "Le prenom du voyageur est obligatoire")
        @Size(max = 100)
        String guestFirstName,

        @NotBlank(message = "Le nom du voyageur est obligatoire")
        @Size(max = 100)
        String guestLastName,

        @NotBlank(message = "L'email du voyageur est obligatoire")
        @Email(message = "L'email du voyageur est invalide")
        String guestEmail,

        @Size(max = 30)
        String guestPhone,

        @Min(value = 1, message = "Le nombre de voyageurs doit etre au moins 1")
        int numberOfGuests,

        @Min(value = 0)
        int numberOfChildren,

        @Size(max = 1000)
        String specialRequests,

        @Size(max = 50)
        String promoCode,

        String locale,

        String currency
) {
    /**
     * Constructeur compact avec valeurs par defaut pour locale et currency.
     */
    public DirectBookingRequest {
        if (locale == null || locale.isBlank()) {
            locale = "fr";
        }
        if (currency == null || currency.isBlank()) {
            currency = "EUR";
        }
    }
}
