package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.repository.MarketplaceProviderAvailabilityRepository;

/** Creneau hebdomadaire. {@code dayOfWeek} suit ISO-8601 : 1 = lundi, 7 = dimanche. */
public record ProviderAvailabilityDto(
    Long id,
    short dayOfWeek,
    String startTime,
    String endTime
) {
    public static ProviderAvailabilityDto from(MarketplaceProviderAvailabilityRepository.EffectiveSlot a) {
        return new ProviderAvailabilityDto(
            a.getId(), a.getDayOfWeek(),
            a.getStartTime().toString(), a.getEndTime().toString());
    }
}
