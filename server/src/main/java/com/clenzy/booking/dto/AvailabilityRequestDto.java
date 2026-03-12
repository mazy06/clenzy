package com.clenzy.booking.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Requete de verification de disponibilite + calcul de prix.
 */
public record AvailabilityRequestDto(
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
    Integer guests
) {}
