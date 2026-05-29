package com.clenzy.dto.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.service.voucher.VoucherUpdatePayload;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Requete REST pour la modification d'un voucher.
 *
 * <p>Tous les champs sont optionnels (null = ne pas modifier). Le {@code type}
 * et {@code createdBy*} ne peuvent pas etre modifies (poses a la creation).</p>
 *
 * <p>{@code propertyIds} : {@code null} = ne pas modifier ; liste vide =
 * repasser en "applicable a toutes les properties" ; liste non vide = remplacer.</p>
 */
public record BookingVoucherUpdateRequestDto(
    @Size(max = 150, message = "name max 150 chars")
    String name,

    String description,

    @Size(max = 64, message = "code max 64 chars")
    String code,

    VoucherDiscountType discountType,

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

    List<Long> propertyIds
) {
    public VoucherUpdatePayload toPayload() {
        return new VoucherUpdatePayload(
            name, description, code,
            discountType, discountValue,
            validFrom, validUntil,
            minStayNights, minTotalAmount, maxStayNights,
            maxUsesTotal, maxUsesPerGuest,
            channelScope, status,
            propertyIds
        );
    }
}
