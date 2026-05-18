package com.clenzy.dto;

/**
 * DTO pour les overrides de minimum de nuits par date.
 * Surcharge le `minimumNights` de la propriete pour des dates specifiques.
 */
public record MinNightsOverrideDto(
    Long id,
    Long propertyId,
    String date,
    Integer minNights,
    String source
) {}
