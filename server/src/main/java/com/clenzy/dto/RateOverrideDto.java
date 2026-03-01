package com.clenzy.dto;

/**
 * DTO pour les overrides de prix par date (RateOverride).
 * Priorite maximale dans la resolution de prix.
 */
public record RateOverrideDto(
    Long id,
    Long propertyId,
    String date,
    Double nightlyPrice,
    String source,
    String currency
) {}
