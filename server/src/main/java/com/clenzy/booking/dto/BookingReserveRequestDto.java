package com.clenzy.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * Requete de creation d'une reservation PENDING via le Booking Engine.
 *
 * <p>Z4A-BUGS-08 : {@code checkIn} accepte le jour meme pour permettre les
 * reservations same-day (minAdvanceDays=0). La validation timezone-aware est
 * faite dans {@code PublicBookingService.checkAvailability}.</p>
 */
public record BookingReserveRequestDto(
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

    @NotNull(message = "guest est obligatoire")
    @Valid
    GuestInfo guest,

    String notes,

    /**
     * Code voucher optionnel saisi par le guest dans le booking engine.
     * Valide + applique au moment de la creation de la reservation.
     * NULL si pas de voucher.
     */
    String voucherCode,

    /**
     * Nombre d'enfants/mineurs parmi les {@code guests} (optionnel, defaut 0 si null).
     * Sert a exonerer les mineurs de la taxe de sejour (adultes = guests - children).
     */
    @Min(value = 0, message = "children doit etre >= 0")
    Integer children
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
