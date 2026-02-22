package com.clenzy.dto;

/**
 * DTO pour les plans tarifaires (RatePlan).
 * Types : BASE, SEASONAL, PROMOTIONAL, LAST_MINUTE.
 */
public record RatePlanDto(
    Long id,
    Long propertyId,
    String name,
    String type,
    Integer priority,
    Double nightlyPrice,
    String currency,
    String startDate,
    String endDate,
    Integer[] daysOfWeek,
    Integer minStayOverride,
    Boolean isActive
) {}
