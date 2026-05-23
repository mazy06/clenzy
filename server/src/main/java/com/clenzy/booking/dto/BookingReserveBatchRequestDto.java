package com.clenzy.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Future;
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
 * <p>Le backend cree N reservations PENDING individuelles et retourne leurs codes. Le
 * paiement Stripe (via {@code /checkout/create-session-batch}) groupera les N en une
 * seule session Embedded Checkout dont la metadata pointera vers les N codes.</p>
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
        @Future(message = "checkIn doit etre dans le futur")
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
