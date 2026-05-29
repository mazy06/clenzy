package com.clenzy.dto.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Requete cote booking engine (guest) pour valider un code voucher en
 * pre-confirmation, et obtenir le discount applicable.
 *
 * <p>Endpoint public ({@code /api/public/vouchers/validate}). N'expose pas
 * le voucher entier au guest (seulement le resultat du calcul ou un message
 * d'erreur).</p>
 */
public record VoucherValidationRequestDto(
    @NotNull(message = "organizationId requis")
    Long organizationId,

    @NotBlank(message = "code requis")
    String code,

    @NotNull(message = "propertyId requis")
    Long propertyId,

    @NotNull(message = "stayNights requis")
    @Min(value = 1, message = "stayNights >= 1")
    Integer stayNights,

    @NotNull(message = "subtotal requis")
    @Positive(message = "subtotal > 0")
    BigDecimal subtotal,

    @Email(message = "guestEmail invalide si fourni")
    String guestEmail,

    @NotNull(message = "channel requis")
    VoucherChannelScope channel
) {}
