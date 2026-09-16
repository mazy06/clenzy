package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.MarketplaceServiceItem;
import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.marketplace.model.ServicePayer;
import com.clenzy.marketplace.model.ServiceRecurrence;

/**
 * Prestation type du catalogue.
 *
 * <p>{@code recurrence} et {@code payer} voyagent avec le libelle : ce sont eux
 * qui disent si la prestation merite une relance datee et vers quel chemin
 * comptable elle part. Les laisser cote serveur aurait oblige l'interface a les
 * redemander prestation par prestation.</p>
 */
public record ServiceItemDto(
    Long id,
    String code,
    String categoryCode,
    String labelFr,
    String labelEn,
    String description,
    PricingModel defaultPricingModel,
    ServiceRecurrence recurrence,
    ServicePayer payer,
    boolean guestSellable,
    boolean regulated,
    int sortOrder,
    String executionMode,
    boolean propertyRequired,
    boolean slotRequired
) {
    public static ServiceItemDto from(MarketplaceServiceItem item) {
        return new ServiceItemDto(
            item.getId(), item.getCode(), item.getCategory().getCode(),
            item.getLabelFr(), item.getLabelEn(), item.getDescription(),
            item.getDefaultPricingModel(), item.getRecurrence(), item.getPayer(),
            item.isGuestSellable(), item.isRegulated(), item.getSortOrder(), item.getExecutionMode(), item.isPropertyRequired(), item.isSlotRequired());
    }
}
