package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;

/** Zone d'intervention declaree. */
public record ProviderZoneDto(
    Long id,
    String countryCode,
    String department,
    String arrondissement,
    String city,
    String postalCode,
    Integer radiusKm,
    boolean primary
) {
    public static ProviderZoneDto from(MarketplaceProviderZoneRepository.EffectiveZone z) {
        return new ProviderZoneDto(
            z.getId(), z.getCountryCode(), z.getDepartment(), z.getArrondissement(), z.getCity(),
            z.getPostalCode(), z.getRadiusKm(), z.isPrimary());
    }
}
