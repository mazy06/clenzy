package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.marketplace.model.ServicePayer;
import com.clenzy.marketplace.model.ServiceRecurrence;

import java.math.BigDecimal;

/**
 * Une prestation vendue, avec son prix.
 *
 * <p>{@code amount} reste vide pour {@link PricingModel#ON_QUOTE} : l'interface
 * affiche « sur devis » plutot qu'un zero qui se lirait comme gratuit.</p>
 */
public record ProviderOfferDto(
    Long id,
    String categoryCode,
    String categoryLabelFr,
    String categoryLabelEn,
    String categoryIconKey,
    String label,
    String description,
    PricingModel pricingModel,
    BigDecimal amount,
    String currency,
    String unitLabel,
    Integer minDurationMinutes,
    boolean active,

    /** Code du catalogue, vide pour une prestation hors referentiel. */
    String serviceItemCode,
    /** Rythme repris du catalogue : dit si la prestation merite une relance datee. */
    ServiceRecurrence recurrence,
    /** Qui paie, repris du catalogue : decide du chemin comptable. */
    ServicePayer payer,
    /** Prestation imposee par la loi. */
    boolean regulated
) {
    public static ProviderOfferDto from(MarketplaceProviderOffer o) {
        var c = o.getCategory();
        var item = o.getServiceItem();
        return new ProviderOfferDto(
            o.getId(),
            c.getCode(), c.getLabelFr(), c.getLabelEn(), c.getIconKey(),
            o.getLabel(), o.getDescription(), o.getPricingModel(),
            o.getAmount(), o.getCurrency(), o.getUnitLabel(),
            o.getMinDurationMinutes(), o.isActive(),
            item == null ? null : item.getCode(),
            item == null ? null : item.getRecurrence(),
            item == null ? null : item.getPayer(),
            item != null && item.isRegulated());
    }
}
