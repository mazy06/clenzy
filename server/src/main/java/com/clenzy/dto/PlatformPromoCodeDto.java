package com.clenzy.dto;

import com.clenzy.model.PlatformPromoCode;

import java.time.LocalDateTime;

/**
 * DTO d'exposition REST des codes promo plateforme.
 *
 * Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite {@link PlatformPromoCode} (audit T-ARCH-07 : jamais d'entite JPA
 * exposee par un endpoint) — champ a champ : id, code, discountType,
 * discountValue, maxUses, usedCount, validFrom, validUntil, active,
 * description, createdAt, createdBy.
 */
public record PlatformPromoCodeDto(
    Long id,
    String code,
    PlatformPromoCode.DiscountType discountType,
    Integer discountValue,
    Integer maxUses,
    Integer usedCount,
    LocalDateTime validFrom,
    LocalDateTime validUntil,
    boolean active,
    String description,
    LocalDateTime createdAt,
    String createdBy
) {

    public static PlatformPromoCodeDto fromEntity(PlatformPromoCode promo) {
        return new PlatformPromoCodeDto(
            promo.getId(),
            promo.getCode(),
            promo.getDiscountType(),
            promo.getDiscountValue(),
            promo.getMaxUses(),
            promo.getUsedCount(),
            promo.getValidFrom(),
            promo.getValidUntil(),
            promo.isActive(),
            promo.getDescription(),
            promo.getCreatedAt(),
            promo.getCreatedBy()
        );
    }
}
