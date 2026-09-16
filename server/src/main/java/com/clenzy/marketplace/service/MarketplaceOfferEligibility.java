package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;

/** Compatibilité commune entre une demande et les offres actuelles du prestataire. */
public final class MarketplaceOfferEligibility {
    private MarketplaceOfferEligibility() {}

    /** Une demande générale reste libre ; une sélection de catalogue doit appartenir à une offre active. */
    public static String requireOfferedService(MarketplaceProvider provider, String categoryCode, String itemCode) {
        if (categoryCode == null && itemCode == null) return null;
        for (var offer : provider.getOffers()) {
            var category = offer.getCategory();
            if (!offer.isActive() || category == null || !category.isActive()) continue;
            if (categoryCode != null && !categoryCode.equals(category.getCode())) continue;
            var item = offer.getServiceItem();
            if (item != null && (!item.isActive() || item.getCategory() == null
                    || !java.util.Objects.equals(category.getCode(), item.getCategory().getCode()))) continue;
            if (itemCode != null && (item == null || !itemCode.equals(item.getCode()))) continue;
            return category.getCode();
        }
        throw new IllegalArgumentException("Cette prestation n'est plus proposée par ce prestataire. Actualisez sa fiche.");
    }



}
