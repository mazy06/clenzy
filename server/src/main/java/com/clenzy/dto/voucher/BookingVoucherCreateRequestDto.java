package com.clenzy.dto.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.service.voucher.VoucherCreatePayload;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Requete REST pour la creation d'un voucher.
 *
 * <p>Bean Validation cote DTO + validation business cote service.</p>
 */
public record BookingVoucherCreateRequestDto(
    @NotBlank(message = "name est obligatoire")
    @Size(max = 150, message = "name max 150 chars")
    String name,

    String description,

    /** Requis pour MANUAL_CODE (verifie au service). Stocke en UPPER. */
    @Size(max = 64, message = "code max 64 chars")
    String code,

    @NotNull(message = "type est obligatoire")
    VoucherType type,

    @NotNull(message = "discountType est obligatoire")
    VoucherDiscountType discountType,

    @NotNull(message = "discountValue est obligatoire")
    @DecimalMin(value = "0.01", message = "discountValue doit etre > 0")
    BigDecimal discountValue,

    Instant validFrom,
    Instant validUntil,

    @Min(value = 1, message = "minStayNights >= 1")
    Integer minStayNights,

    @DecimalMin(value = "0.0", message = "minTotalAmount >= 0")
    BigDecimal minTotalAmount,

    @Min(value = 1, message = "maxStayNights >= 1")
    Integer maxStayNights,

    @Min(value = 1, message = "maxUsesTotal >= 1")
    Integer maxUsesTotal,

    @Min(value = 1, message = "maxUsesPerGuest >= 1")
    Integer maxUsesPerGuest,

    VoucherChannelScope channelScope,

    VoucherStatus status,

    /** Vide ou null = applicable a toutes les properties de l'org. */
    List<Long> propertyIds
) {
    public VoucherCreatePayload toPayload() {
        return new VoucherCreatePayload(
            name, description, code, type, discountType, discountValue,
            validFrom, validUntil,
            minStayNights, minTotalAmount, maxStayNights,
            maxUsesTotal, maxUsesPerGuest,
            channelScope, status,
            propertyIds
        );
    }
}
