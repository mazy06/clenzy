package com.clenzy.booking.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Requete de verification de disponibilite + calcul de prix.
 *
 * <p>Z4A-BUGS-08 : {@code checkIn} accepte le jour meme ({@literal @}FutureOrPresent)
 * pour permettre les reservations same-day quand {@code minAdvanceDays=0}. La
 * validation fine (passe/present/bornes) est refaite dans
 * {@code PublicBookingService.checkAvailability} avec le fuseau horaire de la
 * propriete — les annotations Bean Validation s'evaluent dans le fuseau JVM.</p>
 */
public record AvailabilityRequestDto(
    @NotNull(message = "propertyId est obligatoire")
    Long propertyId,

    @NotNull(message = "checkIn est obligatoire")
    @FutureOrPresent(message = "checkIn ne peut pas etre dans le passe")
    LocalDate checkIn,

    @NotNull(message = "checkOut est obligatoire")
    @Future(message = "checkOut doit etre dans le futur")
    LocalDate checkOut,

    @NotNull(message = "guests est obligatoire")
    @Min(value = 1, message = "guests doit etre >= 1")
    Integer guests
) {}
