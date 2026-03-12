package com.clenzy.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Requete de creation d'une reservation PENDING via le Booking Engine.
 */
public record BookingReserveRequestDto(
    @NotNull(message = "propertyId est obligatoire")
    Long propertyId,

    @NotNull(message = "checkIn est obligatoire")
    @Future(message = "checkIn doit etre dans le futur")
    LocalDate checkIn,

    @NotNull(message = "checkOut est obligatoire")
    @Future(message = "checkOut doit etre dans le futur")
    LocalDate checkOut,

    @NotNull(message = "guests est obligatoire")
    @Min(value = 1, message = "guests doit etre >= 1")
    Integer guests,

    @NotNull(message = "guest est obligatoire")
    @Valid
    GuestInfo guest,

    String notes
) {
    public record GuestInfo(
        @NotBlank(message = "Le nom du guest est obligatoire")
        String name,

        @NotBlank(message = "L'email du guest est obligatoire")
        @Email(message = "L'email du guest est invalide")
        String email,

        String phone
    ) {}
}
