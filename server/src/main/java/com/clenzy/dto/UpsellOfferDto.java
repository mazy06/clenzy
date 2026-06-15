package com.clenzy.dto;

import com.clenzy.model.UpsellOffer;

import java.math.BigDecimal;

/** Offre d'upsell côté admin hôte. */
public record UpsellOfferDto(
        Long id,
        Long propertyId,
        String type,
        String title,
        String description,
        BigDecimal price,
        String currency,
        String imageUrl,
        boolean active,
        int sortOrder,
        Integer minNights,
        Integer leadTimeHours,
        String bundleOfferIds) {

    public static UpsellOfferDto from(UpsellOffer o) {
        return new UpsellOfferDto(
                o.getId(), o.getPropertyId(), o.getType().name(), o.getTitle(), o.getDescription(),
                o.getPrice(), o.getCurrency(), o.getImageUrl(), o.isActive(), o.getSortOrder(),
                o.getMinNights(), o.getLeadTimeHours(), o.getBundleOfferIds());
    }
}
