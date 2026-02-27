package com.clenzy.dto;

import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;

import java.time.Instant;
import java.util.Map;

public record ExternalPricingConfigDto(
    Long id,
    PricingProvider provider,
    String apiUrl,
    Map<String, String> propertyMappings,
    Boolean enabled,
    Instant lastSyncAt,
    Integer syncIntervalHours,
    Instant createdAt
) {
    public static ExternalPricingConfigDto from(ExternalPricingConfig c) {
        return new ExternalPricingConfigDto(
            c.getId(), c.getProvider(), c.getApiUrl(),
            c.getPropertyMappings(), c.getEnabled(),
            c.getLastSyncAt(), c.getSyncIntervalHours(), c.getCreatedAt()
        );
    }
}
