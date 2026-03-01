package com.clenzy.dto;

import com.clenzy.model.PricingProvider;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record UpdateExternalPricingConfigRequest(
    @NotNull PricingProvider provider,
    String apiKey,
    String apiUrl,
    Map<String, String> propertyMappings,
    Boolean enabled,
    Integer syncIntervalHours
) {}
