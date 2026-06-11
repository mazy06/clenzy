package com.clenzy.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Requete de creation d'un panier de reservations PENDING (panier multi-sejours).
 *
 * <p>Le guest est partage entre tous les items (un seul voyageur paie pour plusieurs
 * sejours, eventuellement sur plusieurs proprietes ou plusieurs creneaux).</p>
 *
 * <p>Le backend cree N reservations PENDING individuelles et retourne leurs codes.
 * <b>Le paiement se fait item par item</b> : un appel {@code /checkout} par
 * {@code reservationCode} retourne (Z4A-BUGS-09 — aucun endpoint
 * {@code create-session-batch} n'existe ; l'ancienne javadoc qui l'annoncait
 * etait un contrat fantome). Le {@code batchCode} retourne sert uniquement de
 * correlation cote SDK/logs.</p>
 *
 * <p>La creation est atomique : si un item est indisponible ou si deux items du
 * panier se chevauchent sur la meme propriete, AUCUNE reservation n'est creee.</p>
 */
public record BookingReserveBatchRequestDto(
    @NotEmpty(message = "Le panier doit contenir au moins un item")
    @Size(max = 20, message = "Maximum 20 items par panier")
    @Valid
    List<Item> items,

    @NotNull(message = "guest est obligatoire")
    @Valid
    BookingReserveRequestDto.GuestInfo guest
) {
    public record Item(
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
        Integer guests,

        String notes
    ) {}
}
