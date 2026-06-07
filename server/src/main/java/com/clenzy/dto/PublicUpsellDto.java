package com.clenzy.dto;

import com.clenzy.model.UpsellOffer;

import java.math.BigDecimal;

/** Offre d'upsell exposée au guest sur le livret. */
public record PublicUpsellDto(
        Long offerId,
        String type,
        String title,
        String description,
        BigDecimal price,
        String currency,
        String imageUrl) {

    public static PublicUpsellDto from(UpsellOffer o) {
        return new PublicUpsellDto(
                o.getId(), o.getType().name(), o.getTitle(), o.getDescription(),
                o.getPrice(), o.getCurrency(), o.getImageUrl());
    }
}
