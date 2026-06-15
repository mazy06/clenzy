package com.clenzy.dto;

import com.clenzy.model.UpsellOffer;

import java.math.BigDecimal;
import java.util.List;

/** Offre d'upsell exposée au guest sur le livret. {@code bundleItems} = titres des offres incluses (2.10). */
public record PublicUpsellDto(
        Long offerId,
        String type,
        String title,
        String description,
        BigDecimal price,
        String currency,
        String imageUrl,
        List<String> bundleItems) {

    public static PublicUpsellDto from(UpsellOffer o) {
        return from(o, List.of());
    }

    public static PublicUpsellDto from(UpsellOffer o, List<String> bundleItems) {
        return new PublicUpsellDto(
                o.getId(), o.getType().name(), o.getTitle(), o.getDescription(),
                o.getPrice(), o.getCurrency(), o.getImageUrl(), bundleItems);
    }
}
