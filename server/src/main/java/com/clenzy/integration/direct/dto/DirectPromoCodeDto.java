package com.clenzy.integration.direct.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representant un code promo pour le widget de reservation directe.
 */
public record DirectPromoCodeDto(
        String code,
        String discountType,
        BigDecimal discountValue,
        LocalDate validFrom,
        LocalDate validUntil,
        int minNights,
        int maxUses,
        int currentUses
) {

    public static final String DISCOUNT_PERCENTAGE = "PERCENTAGE";
    public static final String DISCOUNT_FIXED = "FIXED";
}
