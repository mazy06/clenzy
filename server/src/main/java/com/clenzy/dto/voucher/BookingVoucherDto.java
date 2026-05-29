package com.clenzy.dto.voucher;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

/**
 * Reponse REST pour un {@link BookingVoucher}.
 *
 * <p>Flat (pas de relations entity), inclut les ids des properties dans le
 * scope (liste vide = applicable a toutes les properties de l'org).</p>
 */
public record BookingVoucherDto(
    Long id,
    Long organizationId,
    String name,
    String description,
    String code,
    VoucherType type,
    VoucherDiscountType discountType,
    BigDecimal discountValue,
    Instant validFrom,
    Instant validUntil,
    Integer minStayNights,
    BigDecimal minTotalAmount,
    Integer maxStayNights,
    Integer maxUsesTotal,
    Integer maxUsesPerGuest,
    Integer usageCount,
    VoucherChannelScope channelScope,
    VoucherStatus status,
    VoucherCreatorOrgType createdByOrgType,
    Long createdByUserId,
    Set<Long> propertyIds,
    Instant createdAt,
    Instant updatedAt
) {

    /** Mapper depuis l'entite, avec injection separee des propertyIds (calcules par le service). */
    public static BookingVoucherDto from(BookingVoucher v, Set<Long> propertyIds) {
        return new BookingVoucherDto(
            v.getId(),
            v.getOrganizationId(),
            v.getName(),
            v.getDescription(),
            v.getCode(),
            v.getType(),
            v.getDiscountType(),
            v.getDiscountValue(),
            v.getValidFrom(),
            v.getValidUntil(),
            v.getMinStayNights(),
            v.getMinTotalAmount(),
            v.getMaxStayNights(),
            v.getMaxUsesTotal(),
            v.getMaxUsesPerGuest(),
            v.getUsageCount(),
            v.getChannelScope(),
            v.getStatus(),
            v.getCreatedByOrgType(),
            v.getCreatedByUserId(),
            propertyIds,
            v.getCreatedAt(),
            v.getUpdatedAt()
        );
    }
}
